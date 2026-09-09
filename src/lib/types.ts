export type ProviderId = "local" | "openai" | "groq";

/** Every provider that transcribes over the network rather than in the tab. */
export type CloudProviderId = Exclude<ProviderId, "local">;

export type Task = "transcribe" | "translate";

export type JobStatus =
  | "queued"
  | "decoding"
  | "loading-model"
  | "transcribing"
  | "done"
  | "error"
  | "cancelled";

export interface Segment {
  id: number;
  /** seconds */
  start: number;
  /** seconds */
  end: number;
  text: string;
}

export interface Transcript {
  text: string;
  segments: Segment[];
  language: string | null;
  durationSec: number;
  model: string;
  provider: ProviderId;
  task: Task;
  createdAt: number;
  /** wall-clock milliseconds spent transcribing */
  elapsedMs: number;
}

export interface Job {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: JobStatus;
  /** 0..1 */
  progress: number;
  stage: string;
  error?: string;
  durationSec?: number;
  transcript?: Transcript;
  /** live partial text while transcribing (local engine only) */
  partial?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export type Dtype = "fp32" | "q4";
export type Device = "auto" | "webgpu" | "wasm";

export interface Settings {
  provider: ProviderId;
  /** hf repo id for the in-browser whisper model */
  localModel: string;
  dtype: Dtype;
  device: Device;
  /** whisper language code, or "auto" */
  language: string;
  task: Task;
  chunkLengthS: number;
  strideLengthS: number;
  /** model id used by the selected cloud provider */
  cloudModel: string;
  /** optional user-supplied keys, kept in localStorage only */
  apiKeys: Partial<Record<CloudProviderId, string>>;
  theme: "system" | "light" | "dark";
}

export interface ModelOption {
  id: string;
  label: string;
  size: string;
  note: string;
}
