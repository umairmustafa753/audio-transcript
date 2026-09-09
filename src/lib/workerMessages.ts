import type { Device, Dtype, Task } from "./types";

export interface RunRequest {
  type: "run";
  jobId: string;
  /** 16 kHz mono PCM, transferred to the worker */
  pcm: Float32Array;
  durationSec: number;
  model: string;
  dtype: Dtype;
  device: Device;
  /** whisper language code, or "auto" */
  language: string;
  task: Task;
  chunkLengthS: number;
  strideLengthS: number;
}

export interface WarmRequest {
  type: "warm";
  model: string;
  dtype: Dtype;
  device: Device;
}

export interface CancelRequest {
  type: "cancel";
  jobId: string;
}

export type WorkerRequest = RunRequest | WarmRequest | CancelRequest;

export interface RawChunk {
  timestamp: [number, number | null];
  text: string;
}

export type WorkerResponse =
  | { type: "download"; file: string; progress: number; loaded: number; total: number }
  | { type: "ready"; model: string; device: string }
  | { type: "stage"; jobId: string; stage: string; progress: number }
  | { type: "partial"; jobId: string; text: string; progress: number; tps: number | null }
  | {
      type: "result";
      jobId: string;
      text: string;
      chunks: RawChunk[];
      language: string | null;
      device: string;
    }
  | { type: "cancelled"; jobId: string }
  | { type: "error"; jobId: string | null; message: string };
