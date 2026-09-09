"use client";

import type { RunRequest, WorkerRequest, WorkerResponse } from "./workerMessages";
import type { Segment } from "./types";
import { normalizeChunks } from "./segments";

export interface LocalRunHandlers {
  onDownload?: (file: string, progress: number, loaded: number, total: number) => void;
  onStage?: (stage: string, progress: number) => void;
  onPartial?: (text: string, progress: number, tps: number | null) => void;
}

export interface LocalRunResult {
  text: string;
  segments: Segment[];
  language: string | null;
  device: string;
}

class LocalEngine {
  private worker: Worker | null = null;
  private handlers = new Map<string, LocalRunHandlers>();
  private pending = new Map<
    string,
    { resolve: (r: LocalRunResult) => void; reject: (e: Error) => void; durationSec: number }
  >();
  private warmWaiters: { resolve: () => void; reject: (e: Error) => void }[] = [];
  /** Only one job may occupy the single model instance at a time. */
  private queue: Promise<unknown> = Promise.resolve();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("../workers/whisper.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) =>
      this.handle(event.data),
    );
    worker.addEventListener("error", (event) => {
      this.failAll(new Error(event.message || "The transcription worker crashed."));
    });
    this.worker = worker;
    return worker;
  }

  private send(message: WorkerRequest, transfer: Transferable[] = []) {
    this.ensureWorker().postMessage(message, transfer);
  }

  private handle(message: WorkerResponse) {
    switch (message.type) {
      case "download": {
        for (const handler of this.handlers.values()) {
          handler.onDownload?.(message.file, message.progress, message.loaded, message.total);
        }
        break;
      }
      case "ready": {
        const waiters = this.warmWaiters;
        this.warmWaiters = [];
        waiters.forEach((w) => w.resolve());
        break;
      }
      case "stage": {
        this.handlers.get(message.jobId)?.onStage?.(message.stage, message.progress);
        break;
      }
      case "partial": {
        this.handlers.get(message.jobId)?.onPartial?.(message.text, message.progress, message.tps);
        break;
      }
      case "result": {
        const entry = this.pending.get(message.jobId);
        this.cleanup(message.jobId);
        entry?.resolve({
          text: message.text.trim(),
          segments: normalizeChunks(message.chunks, entry.durationSec),
          language: message.language,
          device: message.device,
        });
        break;
      }
      case "cancelled": {
        const entry = this.pending.get(message.jobId);
        this.cleanup(message.jobId);
        entry?.reject(new CancelledError());
        break;
      }
      case "error": {
        const error = new Error(message.message);
        if (message.jobId) {
          const entry = this.pending.get(message.jobId);
          this.cleanup(message.jobId);
          entry?.reject(error);
        } else {
          this.failAll(error);
        }
        break;
      }
    }
  }

  private cleanup(jobId: string) {
    this.pending.delete(jobId);
    this.handlers.delete(jobId);
  }

  private failAll(error: Error) {
    for (const [jobId, entry] of this.pending) {
      this.handlers.delete(jobId);
      entry.reject(error);
    }
    this.pending.clear();
    const waiters = this.warmWaiters;
    this.warmWaiters = [];
    waiters.forEach((w) => w.reject(error));
  }

  warm(model: string, dtype: RunRequest["dtype"], device: RunRequest["device"]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.warmWaiters.push({ resolve, reject });
      this.send({ type: "warm", model, dtype, device });
    });
  }

  run(request: Omit<RunRequest, "type">, handlers: LocalRunHandlers): Promise<LocalRunResult> {
    const task = () =>
      new Promise<LocalRunResult>((resolve, reject) => {
        this.handlers.set(request.jobId, handlers);
        this.pending.set(request.jobId, { resolve, reject, durationSec: request.durationSec });
        // The PCM buffer is transferred, not copied — it can be hundreds of MB.
        this.send({ type: "run", ...request }, [request.pcm.buffer]);
      });

    const chained = this.queue.then(task, task);
    // Keep the chain alive regardless of individual failures.
    this.queue = chained.catch(() => undefined);
    return chained;
  }

  cancel(jobId: string) {
    if (!this.worker) return;
    this.send({ type: "cancel", jobId });
  }

  /** Hard reset — used when the user aborts everything or changes device backend. */
  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.failAll(new CancelledError());
  }
}

export class CancelledError extends Error {
  constructor() {
    super("Cancelled");
    this.name = "CancelledError";
  }
}

let instance: LocalEngine | null = null;

export function localEngine(): LocalEngine {
  if (!instance) instance = new LocalEngine();
  return instance;
}

export function webgpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}
