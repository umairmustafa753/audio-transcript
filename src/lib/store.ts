"use client";

import { create } from "zustand";
import type { CloudProviderId, Job, Segment, Settings, Transcript } from "./types";
import { type DecodedAudio, decodeAudioFile, isProbablyAudio } from "./audio";
import { CancelledError, localEngine } from "./localEngine";
import { transcribeInCloud } from "./cloudEngine";
import type { Backup } from "./backup";
import { joinText } from "./segments";
import { isTerminal } from "./jobStatus";
import { defaultModelFor, isEnglishOnly } from "./models";
import {
  clearPersisted,
  deletePersisted,
  loadPersisted,
  loadSettings,
  persistJob,
  saveSettings,
} from "./db";

export const DEFAULT_SETTINGS: Settings = {
  provider: "local",
  localModel: "onnx-community/whisper-base",
  dtype: "q4",
  device: "auto",
  language: "auto",
  task: "transcribe",
  chunkLengthS: 30,
  strideLengthS: 5,
  cloudModel: "whisper-1",
  apiKeys: {},
  theme: "system",
};

/** Fills gaps from defaults and repairs values that older builds could save. */
function normalizeSettings(stored: Partial<Settings> | null): Settings {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...stored?.apiKeys },
  };
  if (!settings.cloudModel && settings.provider !== "local") {
    settings.cloudModel = defaultModelFor(settings.provider);
  }
  // Older builds offered q8/fp16, which onnxruntime-web cannot load.
  if (settings.dtype !== "q4" && settings.dtype !== "fp32") settings.dtype = "q4";
  return settings;
}

/** Decoding takes the first slice of the progress bar; the engine owns the rest. */
const DECODE_PROGRESS_SHARE = 0.08;

/** Audio blobs and waveforms live outside the reactive store — they are large and never rendered directly. */
interface Media {
  file: File | null;
  url: string | null;
  peaks: Float32Array | null;
}

const media = new Map<string, Media>();

export function getMedia(id: string): Media | undefined {
  return media.get(id);
}

/** Object URLs are minted lazily and revoked when the job is removed. */
export function audioUrl(id: string): string | null {
  const entry = media.get(id);
  if (!entry?.file) return null;
  if (!entry.url) entry.url = URL.createObjectURL(entry.file);
  return entry.url;
}

const abortControllers = new Map<string, AbortController>();

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Queue order is restored by sorting on `createdAt`, but several files added in
 * one drop all land in the same millisecond — and IndexedDB hands keys back in
 * key (UUID) order, so ties would reshuffle the list on every reload. Nudging
 * the clock forward keeps every stamp strictly increasing.
 */
let lastStamp = 0;
function nextStamp(): number {
  const now = Date.now();
  lastStamp = now > lastStamp ? now : lastStamp + 1;
  return lastStamp;
}

interface DownloadState {
  file: string;
  progress: number;
  loaded: number;
  total: number;
}

/** What either engine hands back once a job has finished decoding. */
interface EngineResult {
  segments: Segment[];
  text: string;
  language: string | null;
  model: string;
}

interface AppState {
  jobs: Job[];
  selectedId: string | null;
  settings: Settings;
  hydrated: boolean;
  download: DownloadState | null;
  tps: number | null;
  processing: boolean;

  hydrate: () => Promise<void>;
  addFiles: (files: File[]) => { added: number; rejected: string[] };
  importBackup: (backup: Backup) => Promise<{ added: number; skipped: number }>;
  select: (id: string | null) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  retry: (id: string) => void;
  cancel: (id: string) => void;
  cancelAll: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  warmModel: () => Promise<void>;
}

export const useApp = create<AppState>((set, get) => {
  function patchJob(id: string, patch: Partial<Job>) {
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    }));
  }

  async function save(id: string) {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    const entry = media.get(id);
    await persistJob(job, entry?.file ?? null, entry?.peaks ?? null);
  }

  /** Whisper in a worker: streams partial text and reports weight downloads. */
  async function runOnDevice(
    jobId: string,
    decoded: DecodedAudio,
    settings: Settings,
  ): Promise<EngineResult> {
    patchJob(jobId, { status: "loading-model", stage: "Loading model", progress: 0.09 });

    const result = await localEngine().run(
      {
        jobId,
        pcm: decoded.pcm,
        durationSec: decoded.durationSec,
        model: settings.localModel,
        dtype: settings.dtype,
        device: settings.device,
        language: isEnglishOnly(settings.localModel) ? "en" : settings.language,
        task: settings.task,
        chunkLengthS: settings.chunkLengthS,
        strideLengthS: settings.strideLengthS,
      },
      {
        onDownload: (fileName, progress, loaded, total) => {
          set({ download: { file: fileName, progress, loaded, total } });
        },
        onStage: (stage) => {
          set({ download: null });
          patchJob(jobId, {
            status: stage === "Transcribing" ? "transcribing" : "loading-model",
            stage,
          });
        },
        onPartial: (partial, progress, tps) => {
          set({ tps });
          patchJob(jobId, {
            status: "transcribing",
            stage: "Transcribing",
            partial,
            progress: 0.1 + progress * 0.9,
          });
        },
      },
    );

    return {
      segments: result.segments,
      text: result.text || joinText(result.segments),
      language: result.language,
      model: settings.localModel,
    };
  }

  /** One upload to the API route, abortable so Cancel takes effect mid-flight. */
  async function runInCloud(
    jobId: string,
    file: File,
    decoded: DecodedAudio,
    settings: Settings,
    provider: CloudProviderId,
  ): Promise<EngineResult> {
    patchJob(jobId, {
      status: "transcribing",
      stage: `Uploading to ${provider}`,
      progress: 0.2,
    });

    const controller = new AbortController();
    abortControllers.set(jobId, controller);
    try {
      const result = await transcribeInCloud({
        file,
        provider,
        model: settings.cloudModel,
        language: settings.language,
        task: settings.task,
        apiKey: settings.apiKeys[provider],
        durationSec: decoded.durationSec,
        signal: controller.signal,
      });
      return {
        segments: result.segments,
        text: result.text || joinText(result.segments),
        language: result.language,
        model: settings.cloudModel,
      };
    } finally {
      abortControllers.delete(jobId);
    }
  }

  async function runJob(job: Job) {
    const { settings } = get();
    const entry = media.get(job.id);
    const file = entry?.file;

    if (!file) {
      patchJob(job.id, {
        status: "error",
        error:
          "The audio for this item is no longer in memory. Add the file again to re-run it.",
        progress: 0,
        stage: "",
      });
      void save(job.id);
      return;
    }

    const startedAt = Date.now();
    patchJob(job.id, {
      status: "decoding",
      stage: "Reading audio",
      progress: 0,
      error: undefined,
      partial: "",
      startedAt,
    });

    try {
      const decoded = await decodeAudioFile(file, (fraction) => {
        patchJob(job.id, {
          progress: fraction * DECODE_PROGRESS_SHARE,
          stage: "Reading audio",
        });
      });

      if (entry) entry.peaks = decoded.peaks;
      patchJob(job.id, { durationSec: decoded.durationSec });

      const result =
        settings.provider === "local"
          ? await runOnDevice(job.id, decoded, settings)
          : await runInCloud(job.id, file, decoded, settings, settings.provider);

      const transcript: Transcript = {
        text: result.text,
        segments: result.segments,
        language: result.language,
        durationSec: decoded.durationSec,
        model: result.model,
        provider: settings.provider,
        task: settings.task,
        createdAt: Date.now(),
        elapsedMs: Date.now() - startedAt,
      };

      patchJob(job.id, {
        status: "done",
        progress: 1,
        stage: "",
        partial: undefined,
        transcript,
        finishedAt: Date.now(),
      });
      set({ download: null, tps: null });
      if (!get().selectedId) set({ selectedId: job.id });
      await save(job.id);
    } catch (error) {
      set({ download: null, tps: null });
      if (error instanceof CancelledError || (error as Error)?.name === "AbortError") {
        patchJob(job.id, { status: "cancelled", stage: "", progress: 0, partial: undefined });
      } else {
        patchJob(job.id, {
          status: "error",
          stage: "",
          progress: 0,
          partial: undefined,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await save(job.id);
    }
  }

  async function pump() {
    if (get().processing) return;
    set({ processing: true });
    try {
      for (;;) {
        const next = get().jobs.find((job) => job.status === "queued");
        if (!next) break;
        await runJob(next);
      }
    } finally {
      set({ processing: false, download: null, tps: null });
    }
  }

  /** After a job leaves the list, fall back to the newest finished transcript. */
  function fallbackSelection(jobs: Job[]): string | null {
    return jobs.find((job) => job.status === "done")?.id ?? null;
  }

  return {
    jobs: [],
    selectedId: null,
    settings: DEFAULT_SETTINGS,
    hydrated: false,
    download: null,
    tps: null,
    processing: false,

    async hydrate() {
      if (get().hydrated) return;
      const settings = normalizeSettings(loadSettings());

      const records = await loadPersisted();
      for (const record of records) {
        media.set(record.job.id, { file: record.file, url: null, peaks: record.peaks });
      }
      const jobs = records.map((r) => r.job);
      lastStamp = jobs.reduce((max, job) => Math.max(max, job.createdAt), lastStamp);

      set({ settings, jobs, hydrated: true, selectedId: fallbackSelection(jobs) });
    },

    addFiles(files) {
      const rejected: string[] = [];
      const accepted = files.filter((file) => {
        if (file.size === 0) {
          rejected.push(`${file.name} is empty`);
          return false;
        }
        if (!isProbablyAudio(file)) {
          rejected.push(`${file.name} is not a recognised audio or video file`);
          return false;
        }
        return true;
      });

      const newJobs: Job[] = accepted.map((file) => {
        const id = newId();
        media.set(id, { file, url: null, peaks: null });
        return {
          id,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "audio/*",
          status: "queued",
          progress: 0,
          stage: "Waiting",
          createdAt: nextStamp(),
        };
      });

      if (newJobs.length > 0) {
        set((state) => ({
          jobs: [...state.jobs, ...newJobs],
          selectedId: state.selectedId ?? newJobs[0].id,
        }));
        // Store immediately so a reload mid-queue still lists the files, with
        // their audio, ready to re-run.
        for (const job of newJobs) void save(job.id);
        void pump();
      }

      return { added: newJobs.length, rejected };
    },

    async importBackup(backup) {
      const known = new Set(get().jobs.map((job) => job.id));
      // Importing the same backup twice must not duplicate anything.
      const fresh = backup.records.filter((record) => !known.has(record.job.id));

      for (const record of fresh) {
        media.set(record.job.id, { file: record.file, url: null, peaks: record.peaks });
        await persistJob(record.job, record.file, record.peaks);
      }

      const jobs = [...get().jobs, ...fresh.map((r) => r.job)].sort(
        (a, b) => a.createdAt - b.createdAt,
      );
      lastStamp = jobs.reduce((max, job) => Math.max(max, job.createdAt), lastStamp);
      set((state) => ({ jobs, selectedId: state.selectedId ?? fallbackSelection(jobs) }));

      // Backups never carry API keys, so keep whichever ones are already set here.
      get().updateSettings(
        normalizeSettings({ ...backup.settings, apiKeys: get().settings.apiKeys }),
      );

      return { added: fresh.length, skipped: backup.records.length - fresh.length };
    },

    select(id) {
      set({ selectedId: id });
    },

    remove(id) {
      get().cancel(id);
      const entry = media.get(id);
      if (entry?.url) URL.revokeObjectURL(entry.url);
      media.delete(id);
      void deletePersisted(id);
      set((state) => {
        const jobs = state.jobs.filter((job) => job.id !== id);
        return {
          jobs,
          selectedId:
            state.selectedId === id ? fallbackSelection(jobs) : state.selectedId,
        };
      });
    },

    clearAll() {
      get().cancelAll();
      for (const entry of media.values()) {
        if (entry.url) URL.revokeObjectURL(entry.url);
      }
      media.clear();
      void clearPersisted();
      set({ jobs: [], selectedId: null, download: null, tps: null });
    },

    retry(id) {
      const job = get().jobs.find((j) => j.id === id);
      if (!job) return;
      patchJob(id, {
        status: "queued",
        stage: "Waiting",
        progress: 0,
        error: undefined,
        partial: undefined,
        transcript: undefined,
      });
      void pump();
    },

    cancel(id) {
      const job = get().jobs.find((j) => j.id === id);
      if (!job || isTerminal(job.status)) return;

      abortControllers.get(id)?.abort();
      localEngine().cancel(id);
      patchJob(id, { status: "cancelled", stage: "", progress: 0, partial: undefined });
      void save(id);
    },

    cancelAll() {
      for (const job of get().jobs) {
        if (!isTerminal(job.status)) get().cancel(job.id);
      }
    },

    updateSettings(patch) {
      const previous = get().settings;
      const next: Settings = { ...previous, ...patch };

      // Keep the selected model consistent with the selected provider.
      if (patch.provider && patch.provider !== previous.provider && !patch.cloudModel) {
        if (patch.provider !== "local") next.cloudModel = defaultModelFor(patch.provider);
      }
      // Switching the compute backend invalidates the loaded model instance.
      if (patch.device && patch.device !== previous.device) {
        localEngine().terminate();
      }

      set({ settings: next });
      saveSettings(next);
    },

    async warmModel() {
      const { settings } = get();
      if (settings.provider !== "local") return;
      try {
        await localEngine().warm(settings.localModel, settings.dtype, settings.device);
      } finally {
        set({ download: null });
      }
    },
  };
});
