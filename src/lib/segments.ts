import type { Segment } from "./types";
import type { RawChunk } from "./workerMessages";

/**
 * Whisper occasionally emits a null end timestamp (usually the final chunk) and,
 * on long files, timestamps that drift backwards across chunk boundaries. Clamp
 * everything into a monotonic, in-range timeline so seeking and subtitle export
 * stay correct.
 */
export function normalizeChunks(chunks: RawChunk[], durationSec: number): Segment[] {
  const segments: Segment[] = [];
  let previousEnd = 0;

  for (const chunk of chunks) {
    const text = (chunk?.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;

    const rawStart = Number(chunk?.timestamp?.[0]);
    const rawEnd = Number(chunk?.timestamp?.[1]);

    let start = Number.isFinite(rawStart) ? rawStart : previousEnd;
    start = Math.min(Math.max(start, previousEnd), durationSec || start);

    let end = Number.isFinite(rawEnd) ? rawEnd : start + estimateSpokenSeconds(text);
    if (durationSec > 0) end = Math.min(end, durationSec);
    if (end <= start) end = Math.min(start + 0.25, durationSec || start + 0.25);

    segments.push({ id: segments.length, start, end, text });
    previousEnd = end;
  }

  return segments;
}

/** ~2.8 words per second is a reasonable speaking rate for filling a missing end time. */
function estimateSpokenSeconds(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(0.4, words / 2.8);
}

/** Build a single fallback segment for providers that return text without timings. */
export function singleSegment(text: string, durationSec: number): Segment[] {
  const clean = text.trim();
  if (!clean) return [];
  return [{ id: 0, start: 0, end: durationSec || 0, text: clean }];
}

export function findActiveSegment(segments: Segment[], time: number): number {
  // Binary search — transcripts of multi-hour audio can run to thousands of segments.
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    if (time < seg.start) {
      hi = mid - 1;
    } else if (time >= seg.end) {
      lo = mid + 1;
    } else {
      found = mid;
      break;
    }
  }
  if (found !== -1) return found;
  // Between segments: highlight the one that just finished.
  return Math.max(0, Math.min(segments.length - 1, hi));
}

export function joinText(segments: Segment[]): string {
  return segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
}
