"use client";

import { createStore, get, set, del, clear, keys, type UseStore } from "idb-keyval";
import type { Job, Settings } from "./types";
import { isTerminal } from "./jobStatus";
import { SETTINGS_STORAGE_KEY } from "./storageKeys";

/** Audio larger than this is not copied into IndexedDB — transcripts still persist. */
const MAX_PERSISTED_AUDIO_BYTES = 120 * 1024 * 1024;

interface StoredRecord {
  job: Job;
  file: File | null;
  peaks: Float32Array | null;
}

let store: UseStore | null = null;

function jobStore(): UseStore {
  if (!store) store = createStore("audio-transcription", "jobs");
  return store;
}

export async function persistJob(
  job: Job,
  file: File | null,
  peaks: Float32Array | null,
): Promise<void> {
  // Transient fields never need to survive a reload. A job that is still in
  // flight is only ever read back if the page went away mid-run, so it is
  // stored as cancelled — the row then offers "Run again" instead of sitting
  // on a queue that no longer exists.
  const clean: Job = { ...job, partial: undefined };
  if (!isTerminal(clean.status)) {
    clean.status = "cancelled";
    clean.progress = 0;
    clean.stage = "";
  }
  const record: StoredRecord = {
    job: clean,
    file: file && file.size <= MAX_PERSISTED_AUDIO_BYTES ? file : null,
    peaks,
  };
  try {
    await set(job.id, record, jobStore());
  } catch (error) {
    // Quota errors must not take the app down; the session keeps working in memory.
    console.warn("Could not persist job to IndexedDB:", error);
  }
}

export async function loadPersisted(): Promise<StoredRecord[]> {
  try {
    const ids = await keys(jobStore());
    const records = await Promise.all(ids.map((id) => get<StoredRecord>(id, jobStore())));
    return records
      .filter((r): r is StoredRecord => Boolean(r?.job))
      .sort((a, b) => a.job.createdAt - b.job.createdAt);
  } catch (error) {
    console.warn("Could not read saved transcripts:", error);
    return [];
  }
}

export async function deletePersisted(id: string): Promise<void> {
  try {
    await del(id, jobStore());
  } catch {
    /* best effort */
  }
}

export async function clearPersisted(): Promise<void> {
  try {
    await clear(jobStore());
  } catch {
    /* best effort */
  }
}

export function loadSettings(): Partial<Settings> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Settings>) : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* private-mode browsers can reject writes */
  }
}
