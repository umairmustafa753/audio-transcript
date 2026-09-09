"use client";

import type { ProviderId, Segment, Task } from "./types";
import { singleSegment } from "./segments";

export interface CloudRunResult {
  text: string;
  segments: Segment[];
  language: string | null;
}

export interface CloudRunOptions {
  file: File;
  provider: Exclude<ProviderId, "local">;
  model: string;
  language: string;
  task: Task;
  apiKey?: string;
  durationSec: number;
  signal?: AbortSignal;
}

/** Cloud providers map many language names onto ISO codes; normalise for display. */
function normalizeLanguage(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length <= 3) return trimmed;
  const NAMES: Record<string, string> = {
    english: "en", spanish: "es", french: "fr", german: "de", italian: "it",
    portuguese: "pt", dutch: "nl", russian: "ru", chinese: "zh", japanese: "ja",
    korean: "ko", arabic: "ar", hindi: "hi", turkish: "tr", polish: "pl",
    ukrainian: "uk", swedish: "sv", norwegian: "no", danish: "da", finnish: "fi",
    urdu: "ur", indonesian: "id", vietnamese: "vi", thai: "th", hebrew: "he",
  };
  return NAMES[trimmed] ?? trimmed;
}

export async function transcribeInCloud(options: CloudRunOptions): Promise<CloudRunResult> {
  const form = new FormData();
  form.set("file", options.file, options.file.name);
  form.set("provider", options.provider);
  form.set("model", options.model);
  form.set("language", options.language);
  form.set("task", options.task);

  const headers: Record<string, string> = {};
  if (options.apiKey) headers["x-provider-key"] = options.apiKey;

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: form,
    headers,
    signal: options.signal,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? `Transcription failed with status ${response.status}.`);
  }

  const text: string = payload?.text ?? "";
  const rawSegments: { start: number; end: number; text: string }[] = payload?.segments ?? [];

  const segments: Segment[] =
    rawSegments.length > 0
      ? rawSegments.map((seg, i) => ({ id: i, start: seg.start, end: seg.end, text: seg.text }))
      : singleSegment(text, options.durationSec);

  return { text: text.trim(), segments, language: normalizeLanguage(payload?.language ?? null) };
}
