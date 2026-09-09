/// <reference lib="webworker" />
import {
  pipeline,
  env,
  WhisperTextStreamer,
  InterruptableStoppingCriteria,
  Tensor,
  type ProgressCallback,
} from "@huggingface/transformers";
import type {
  RawChunk,
  RunRequest,
  WarmRequest,
  WorkerRequest,
  WorkerResponse,
} from "@/lib/workerMessages";
import type { Device, Dtype } from "@/lib/types";
const LANGUAGE_TOKEN = /^<\|([a-z]{2,3})\|>$/;
const DETECTION_WINDOW_SAMPLES = 30 * 16000;
/** Anything below this is treated as silence when hunting for speech to sample. */
const SILENCE_THRESHOLD = 0.015;

// Weights come from the Hugging Face CDN and are cached by the browser afterwards.
env.allowLocalModels = false;
env.useBrowserCache = true;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(message: WorkerResponse, transfer: Transferable[] = []) {
  ctx.postMessage(message, transfer);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Transcriber = any;

let cached: { key: string; transcriber: Transcriber; device: string } | null = null;
const stoppers = new Map<string, InterruptableStoppingCriteria>();
const cancelledBeforeStart = new Set<string>();

async function resolveDevice(preference: Device): Promise<"webgpu" | "wasm"> {
  if (preference === "wasm") return "wasm";
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) {
    if (preference === "webgpu") {
      throw new Error(
        "WebGPU is not available in this browser. Switch the device setting to WASM, or use a Chromium-based browser.",
      );
    }
    return "wasm";
  }
  try {
    const adapter = await gpu.requestAdapter();
    if (adapter) return "webgpu";
  } catch {
    /* fall through */
  }
  if (preference === "webgpu") {
    throw new Error("WebGPU was requested but no compatible GPU adapter was found.");
  }
  return "wasm";
}

/**
 * `q4` is only applied to the decoder — quantising the Whisper encoder that far
 * degrades it badly, so it stays at fp32.
 *
 * Only these two precisions are offered. onnxruntime-web cannot build a session
 * for the `_quantized` (q8) or `_fp16` Whisper graphs published by onnx-community,
 * so exposing them would just be a way to fail.
 */
function dtypeConfig(dtype: Dtype) {
  if (dtype === "q4") return { encoder_model: "fp32", decoder_model_merged: "q4" } as const;
  return dtype;
}

async function getTranscriber(
  model: string,
  dtype: Dtype,
  devicePreference: Device,
): Promise<{ transcriber: Transcriber; device: string }> {
  const device = await resolveDevice(devicePreference);
  const key = `${model}|${dtype}|${device}`;
  if (cached?.key === key) return { transcriber: cached.transcriber, device: cached.device };

  if (cached) {
    try {
      await cached.transcriber.dispose?.();
    } catch {
      /* disposing a stale pipeline is best-effort */
    }
    cached = null;
  }

  const progress_callback: ProgressCallback = (item) => {
    if (item.status === "progress") {
      post({
        type: "download",
        file: item.file,
        progress: Math.max(0, Math.min(1, (item.progress ?? 0) / 100)),
        loaded: item.loaded ?? 0,
        total: item.total ?? 0,
      });
    }
  };

  const transcriber = await pipeline("automatic-speech-recognition", model, {
    dtype: dtypeConfig(dtype) as never,
    device,
    progress_callback,
  });

  cached = { key, transcriber, device };
  post({ type: "ready", model, device });
  return { transcriber, device };
}

/** transformers.js quantises timestamps to the model's frame resolution. */
function timePrecision(transcriber: Transcriber): number {
  const chunkLength = transcriber?.processor?.feature_extractor?.config?.chunk_length;
  const maxPositions = transcriber?.model?.config?.max_source_positions;
  if (typeof chunkLength === "number" && typeof maxPositions === "number" && maxPositions > 0) {
    return chunkLength / maxPositions;
  }
  return 0.02;
}

/**
 * Pick a 30-second window that actually contains speech. Long recordings often
 * open with silence or music, and language detection reads only one window.
 */
function detectionWindow(pcm: Float32Array): Float32Array {
  if (pcm.length <= DETECTION_WINDOW_SAMPLES) return pcm;
  const stride = 1600; // 100 ms
  for (let i = 0; i + stride < pcm.length; i += stride) {
    let peak = 0;
    for (let j = i; j < i + stride; j += 8) {
      const v = pcm[j] < 0 ? -pcm[j] : pcm[j];
      if (v > peak) peak = v;
    }
    if (peak > SILENCE_THRESHOLD) {
      const start = Math.min(i, Math.max(0, pcm.length - DETECTION_WINDOW_SAMPLES));
      return pcm.subarray(start, start + DETECTION_WINDOW_SAMPLES);
    }
  }
  return pcm.subarray(0, DETECTION_WINDOW_SAMPLES);
}

/**
 * transformers.js does not detect the spoken language — with no `language` set it
 * simply forces English, which silently mistranscribes everything else. Whisper
 * can do the detection itself: run one decoder step from `<|startoftranscript|>`
 * and take the highest-scoring language token.
 */
async function detectLanguage(
  transcriber: Transcriber,
  pcm: Float32Array,
): Promise<string | null> {
  const config = transcriber?.model?.generation_config;
  const langToId: Record<string, number> | undefined = config?.lang_to_id;
  if (!config?.is_multilingual || !langToId || config.decoder_start_token_id == null) {
    return null;
  }

  const inputs = await transcriber.processor(detectionWindow(pcm));
  const decoderInputIds = new Tensor(
    "int64",
    new BigInt64Array([BigInt(config.decoder_start_token_id)]),
    [1, 1],
  );

  const output = await transcriber.model({ ...inputs, decoder_input_ids: decoderInputIds });
  const logits: number[] = output?.logits?.tolist?.()?.[0]?.[0];
  if (!Array.isArray(logits)) return null;

  let bestCode: string | null = null;
  let bestScore = -Infinity;
  for (const [token, id] of Object.entries(langToId)) {
    const score = logits[id];
    if (typeof score !== "number" || Number.isNaN(score)) continue;
    if (score > bestScore) {
      bestScore = score;
      const match = LANGUAGE_TOKEN.exec(token);
      bestCode = match ? match[1] : null;
    }
  }
  return bestCode;
}

async function run(request: RunRequest) {
  const { jobId, pcm, durationSec, model, dtype, device, language, task } = request;

  if (cancelledBeforeStart.delete(jobId)) {
    post({ type: "cancelled", jobId });
    return;
  }

  post({ type: "stage", jobId, stage: "Loading model", progress: 0 });
  const { transcriber, device: resolvedDevice } = await getTranscriber(model, dtype, device);

  const stopper = new InterruptableStoppingCriteria();
  stoppers.set(jobId, stopper);

  // Audio shorter than Whisper's 30s receptive field needs no chunking.
  const useChunking = durationSec > 30;
  const chunkLengthS = useChunking ? request.chunkLengthS : 0;
  const strideLengthS = useChunking ? request.strideLengthS : 0;

  let chunkCount = 0;
  let tokenCount = 0;
  let firstTokenAt: number | null = null;
  let text = "";
  let lastPost = 0;
  const emitProgress = (currentTime: number, force = false) => {
    const elapsedAudio = useChunking
      ? Math.max(0, chunkLengthS - strideLengthS) * chunkCount + currentTime
      : currentTime;
    const progress = durationSec > 0 ? Math.min(0.999, elapsedAudio / durationSec) : 0;
    const now = performance.now();
    if (!force && now - lastPost < 120) return;
    lastPost = now;
    const tps =
      firstTokenAt !== null && tokenCount > 1
        ? (tokenCount - 1) / ((now - firstTokenAt) / 1000)
        : null;
    post({ type: "partial", jobId, text, progress, tps });
  };

  const streamer = new WhisperTextStreamer(transcriber.tokenizer, {
    time_precision: timePrecision(transcriber),
    skip_prompt: true,
    on_chunk_start: () => {
      emitProgress(0, true);
    },
    token_callback_function: () => {
      if (firstTokenAt === null) firstTokenAt = performance.now();
      tokenCount++;
    },
    callback_function: (piece: string) => {
      text += piece;
      emitProgress(0);
    },
    on_chunk_end: (time: number) => {
      emitProgress(time, true);
    },
    on_finalize: () => {
      chunkCount++;
    },
  });

  const isEnglishOnly = model.endsWith(".en");

  // Resolve "auto" to a concrete language before generating, so the model is
  // never left to fall back to English on non-English audio.
  let resolvedLanguage: string | null = isEnglishOnly ? "en" : language;
  let detectedLanguage: string | null = null;
  if (!isEnglishOnly && language === "auto") {
    post({ type: "stage", jobId, stage: "Detecting language", progress: 0 });
    try {
      detectedLanguage = await detectLanguage(transcriber, pcm);
    } catch {
      // Detection is an optimisation; fall through to English if it fails.
    }
    resolvedLanguage = detectedLanguage ?? "en";
  }

  if (stopper.interrupted) {
    stoppers.delete(jobId);
    post({ type: "cancelled", jobId });
    return;
  }

  post({ type: "stage", jobId, stage: "Transcribing", progress: 0 });

  const options: Record<string, unknown> = {
    return_timestamps: true,
    force_full_sequences: false,
    streamer,
    stopping_criteria: stopper,
  };
  if (useChunking) {
    options.chunk_length_s = chunkLengthS;
    options.stride_length_s = strideLengthS;
  }
  if (!isEnglishOnly) {
    options.task = task;
    options.language = resolvedLanguage;
  }

  try {
    const output = await transcriber(pcm, options);
    if (stopper.interrupted) {
      post({ type: "cancelled", jobId });
      return;
    }

    const rawChunks: RawChunk[] = Array.isArray(output?.chunks) ? output.chunks : [];
    post({
      type: "result",
      jobId,
      text: typeof output?.text === "string" ? output.text : text,
      chunks: rawChunks,
      language: resolvedLanguage,
      device: resolvedDevice,
    });
  } finally {
    stoppers.delete(jobId);
  }
}

async function warm(request: WarmRequest) {
  await getTranscriber(request.model, request.dtype, request.device);
}

ctx.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  if (request.type === "cancel") {
    const stopper = stoppers.get(request.jobId);
    if (stopper) {
      stopper.interrupt();
    } else {
      // Cancelled while still queued behind another job.
      cancelledBeforeStart.add(request.jobId);
      post({ type: "cancelled", jobId: request.jobId });
    }
    return;
  }

  const jobId = request.type === "run" ? request.jobId : null;
  const work = request.type === "run" ? run(request) : warm(request);

  work.catch((error: unknown) => {
    post({
      type: "error",
      jobId,
      message: error instanceof Error ? error.message : String(error),
    });
  });
});
