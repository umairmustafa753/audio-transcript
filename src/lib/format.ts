import type { Segment, Transcript } from "./types";
import { languageName } from "./languages";

/** `12:34` or `1:02:03` — for UI clocks. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0
    ? `${h}:${mm}:${String(s).padStart(2, "0")}`
    : `${mm}:${String(s).padStart(2, "0")}`;
}

function stamp(seconds: number, msSep: "," | "."): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const ms = Math.floor((seconds % 1) * 1000);
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return (
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:` +
    `${String(s).padStart(2, "0")}${msSep}${String(ms).padStart(3, "0")}`
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export type ExportFormat = "txt" | "srt" | "vtt" | "json" | "md" | "csv";

export const EXPORT_FORMATS: {
  id: ExportFormat;
  label: string;
  ext: string;
  mime: string;
  needsSegments: boolean;
}[] = [
  { id: "txt", label: "Plain text", ext: "txt", mime: "text/plain", needsSegments: false },
  { id: "srt", label: "SubRip (.srt)", ext: "srt", mime: "application/x-subrip", needsSegments: true },
  { id: "vtt", label: "WebVTT (.vtt)", ext: "vtt", mime: "text/vtt", needsSegments: true },
  { id: "md", label: "Markdown", ext: "md", mime: "text/markdown", needsSegments: false },
  { id: "csv", label: "CSV", ext: "csv", mime: "text/csv", needsSegments: true },
  { id: "json", label: "JSON", ext: "json", mime: "application/json", needsSegments: false },
];

function toSrt(segments: Segment[]): string {
  return segments
    .map((seg, i) => {
      const body = seg.text.trim();
      return `${i + 1}\n${stamp(seg.start, ",")} --> ${stamp(seg.end, ",")}\n${body}\n`;
    })
    .join("\n");
}

function toVtt(segments: Segment[]): string {
  const cues = segments
    .map((seg) => `${stamp(seg.start, ".")} --> ${stamp(seg.end, ".")}\n${seg.text.trim()}\n`)
    .join("\n");
  return `WEBVTT\n\n${cues}`;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv(segments: Segment[]): string {
  const rows = segments.map((s) =>
    [s.id, s.start.toFixed(3), s.end.toFixed(3), csvCell(s.text.trim())].join(","),
  );
  return ["index,start_seconds,end_seconds,text", ...rows].join("\n");
}

function toMarkdown(transcript: Transcript, fileName: string): string {
  const head = [
    `# Transcript — ${fileName}`,
    "",
    `- **Duration:** ${formatDuration(transcript.durationSec)}`,
    `- **Language:** ${languageName(transcript.language)}`,
    `- **Model:** \`${transcript.model}\` (${transcript.provider})`,
    `- **Task:** ${transcript.task}`,
    `- **Generated:** ${new Date(transcript.createdAt).toLocaleString()}`,
    "",
    "---",
    "",
  ].join("\n");

  if (transcript.segments.length === 0) return `${head}${transcript.text.trim()}\n`;

  const body = transcript.segments
    .map((s) => `**[${formatClock(s.start)}]** ${s.text.trim()}`)
    .join("\n\n");
  return `${head}${body}\n`;
}

/** Re-flow segments into readable paragraphs, breaking on long silences. */
export function toParagraphs(segments: Segment[], gapSeconds = 1.4): string[] {
  if (segments.length === 0) return [];
  const paragraphs: string[] = [];
  let current: string[] = [];
  let previousEnd = segments[0].start;

  for (const seg of segments) {
    const text = seg.text.trim();
    if (!text) continue;
    const isBreak =
      seg.start - previousEnd > gapSeconds ||
      current.join(" ").length > 700;
    if (isBreak && current.length > 0) {
      paragraphs.push(current.join(" "));
      current = [];
    }
    current.push(text);
    previousEnd = seg.end;
  }
  if (current.length > 0) paragraphs.push(current.join(" "));
  return paragraphs;
}

export function serialize(
  transcript: Transcript,
  fileName: string,
  format: ExportFormat,
): string {
  switch (format) {
    case "srt":
      return toSrt(transcript.segments);
    case "vtt":
      return toVtt(transcript.segments);
    case "csv":
      return toCsv(transcript.segments);
    case "md":
      return toMarkdown(transcript, fileName);
    case "json":
      return JSON.stringify({ file: fileName, ...transcript }, null, 2);
    case "txt":
    default: {
      const paragraphs = toParagraphs(transcript.segments);
      return paragraphs.length > 0
        ? paragraphs.join("\n\n")
        : transcript.text.trim();
    }
  }
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, "") || "transcript";
}

export function download(content: string, fileName: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
