import type { JobStatus } from "./types";

/** Statuses where the queue is actively working on a job. */
const BUSY = new Set<JobStatus>(["decoding", "loading-model", "transcribing"]);

/** Statuses a job never leaves on its own — nothing left to cancel or wait for. */
const TERMINAL = new Set<JobStatus>(["done", "error", "cancelled"]);

export function isBusy(status: JobStatus): boolean {
  return BUSY.has(status);
}

export function isTerminal(status: JobStatus): boolean {
  return TERMINAL.has(status);
}
