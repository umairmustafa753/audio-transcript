"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, Crosshair, RotateCcw, Search, X } from "lucide-react";
import type { Job } from "@/lib/types";
import { audioUrl, getMedia, useApp } from "@/lib/store";
import { findActiveSegment } from "@/lib/segments";
import { formatClock, formatDuration, toParagraphs } from "@/lib/format";
import { languageName } from "@/lib/languages";
import { AudioPlayer, useAudioPlayer } from "./AudioPlayer";
import { ExportMenu } from "./ExportMenu";
import { Button, IconButton, LiveDot, Progress, Segmented } from "./ui";

type ViewMode = "timestamps" | "reading";

/** Split text on a query so matches can be wrapped without dangerouslySetInnerHTML. */
function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const needle = query.trim().toLowerCase();
  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  let key = 0;
  let cursor = 0;
  for (;;) {
    const at = lower.indexOf(needle, cursor);
    if (at === -1) break;
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(
      <mark
        key={key++}
        className="rounded-[3px] bg-active-soft px-0.5 text-active shadow-[0_0_0_1px_var(--active-line)]"
      >
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    cursor = at + needle.length;
  }
  parts.push(text.slice(cursor));
  return parts;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
        {label}
      </span>
      <span className="text-[13.5px] font-medium tabular-nums tracking-[-0.015em] text-ink">
        {value}
      </span>
    </div>
  );
}

export function TranscriptPanel({ job }: { job: Job }) {
  const retry = useApp((s) => s.retry);
  const cancel = useApp((s) => s.cancel);
  const tps = useApp((s) => s.tps);

  const [view, setView] = useState<ViewMode>("timestamps");
  const [query, setQuery] = useState("");
  const [follow, setFollow] = useState(true);

  const url = useMemo(() => audioUrl(job.id), [job.id]);
  const peaks = getMedia(job.id)?.peaks ?? null;
  const player = useAudioPlayer(url);
  const { currentTime, seek, toggle, audioRef } = player;
  const searchRef = useRef<HTMLInputElement>(null);

  const transcript = job.transcript;
  // Memoised so the empty-array fallback does not invalidate every derived value.
  const segments = useMemo(() => transcript?.segments ?? [], [transcript?.segments]);

  const activeIndex = useMemo(
    () => (segments.length === 0 ? -1 : findActiveSegment(segments, currentTime)),
    [segments, currentTime],
  );

  const activeRef = useRef<HTMLLIElement>(null);

  /**
   * Review shortcuts. Time is read straight off the media element so the handler
   * does not need to re-bind on every frame of playback.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (typing) {
        if (event.key === "Escape") target?.blur();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // The waveform handles its own arrow keys while focused.
      if (target?.getAttribute("role") === "slider" && event.key.startsWith("Arrow")) return;

      const audio = audioRef.current;
      switch (event.key) {
        case " ":
          event.preventDefault();
          toggle();
          break;
        case "ArrowLeft":
          if (!audio) return;
          event.preventDefault();
          seek(audio.currentTime - 5);
          break;
        case "ArrowRight":
          if (!audio) return;
          event.preventDefault();
          seek(audio.currentTime + 5);
          break;
        case "/":
          event.preventDefault();
          searchRef.current?.focus();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [seek, toggle, audioRef]);

  // Keep the spoken line in view while playing, unless the user turned it off.
  useEffect(() => {
    if (!follow || view !== "timestamps" || !player.playing) return;
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex, follow, view, player.playing]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return 0;
    return segments.reduce((count, seg) => {
      const hay = seg.text.toLowerCase();
      let at = hay.indexOf(needle);
      while (at !== -1) {
        count += 1;
        at = hay.indexOf(needle, at + needle.length);
      }
      return count;
    }, 0);
  }, [segments, query]);

  const visibleSegments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return segments;
    return segments.filter((seg) => seg.text.toLowerCase().includes(needle));
  }, [segments, query]);

  const paragraphs = useMemo(() => toParagraphs(segments), [segments]);
  const words = useMemo(
    () => (transcript?.text ?? "").split(/\s+/).filter(Boolean).length,
    [transcript?.text],
  );

  const busy =
    job.status === "decoding" || job.status === "loading-model" || job.status === "transcribing";

  return (
    <section className="relative z-10 flex min-h-0 flex-1 flex-col">
      {/* ---------------- header ---------------- */}
      <header className="flex flex-col gap-5 border-b border-line px-7 pb-6 pt-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1
              className="truncate text-[26px] font-semibold leading-[1.15] tracking-[-0.033em] text-ink"
              title={job.fileName}
            >
              {job.fileName}
            </h1>

            {transcript ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
                <Meta label="Length" value={formatDuration(transcript.durationSec)} />
                <Meta label="Language" value={languageName(transcript.language)} />
                <Meta label="Words" value={words.toLocaleString()} />
                <Meta
                  label="Model"
                  value={transcript.model.split("/").pop() ?? transcript.model}
                />
                <Meta label="Runtime" value={formatDuration(transcript.elapsedMs / 1000)} />
                {transcript.task === "translate" ? (
                  <Meta label="Output" value="Translated" />
                ) : null}
              </div>
            ) : (
              <p
                className={clsx(
                  "mt-2 text-[12.5px]",
                  job.status === "error" ? "text-danger" : "text-muted",
                )}
              >
                {job.status === "error" ? "Failed" : job.stage || "Queued"}
              </p>
            )}
          </div>

          {transcript ? <ExportMenu transcript={transcript} fileName={job.fileName} /> : null}
        </div>

        {transcript || busy ? (
          <AudioPlayer
            url={url}
            peaks={peaks}
            fallbackDuration={transcript?.durationSec ?? job.durationSec ?? 0}
            player={player}
          />
        ) : null}
      </header>

      {/* ---------------- live progress ---------------- */}
      {busy ? (
        <div className="border-b border-line bg-surface/50 px-7 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[12.5px]">
              <LiveDot />
              <span className="font-medium text-ink">{job.stage || "Working"}</span>
              <span className="font-mono tabular-nums text-muted">
                {Math.round(job.progress * 100)}%
              </span>
              {tps ? (
                <span className="font-mono tabular-nums text-faint">{tps.toFixed(1)} tok/s</span>
              ) : null}
            </span>
            <Button size="sm" variant="ghost" onClick={() => cancel(job.id)}>
              <X className="size-3.5" />
              Cancel
            </Button>
          </div>

          <Progress
            className="mt-2.5"
            value={job.progress}
            indeterminate={job.progress < 0.02}
          />

          {job.partial ? (
            <p className="mt-3 max-h-28 overflow-y-auto whitespace-pre-wrap text-[13px] leading-[1.65] text-muted">
              {job.partial}
              <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 rounded-full bg-accent breathe" />
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ---------------- toolbar ---------------- */}
      {transcript && segments.length > 0 ? (
        <div className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-line bg-panel/80 px-7 py-3 backdrop-blur-xl">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this transcript…"
              className={clsx(
                "h-8 w-full rounded-[9px] border border-line bg-surface-2 pl-8 pr-8",
                "text-[12.5px] text-ink placeholder:text-faint shadow-[var(--inset-top)]",
                "transition-colors hover:border-line-strong",
              )}
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-faint transition-colors hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-surface-3 px-1.5 py-px font-mono text-[10px] text-faint sm:block">
                /
              </kbd>
            )}
          </div>

          {query ? (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
              {matches} match{matches === 1 ? "" : "es"}
            </span>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <IconButton
              label={follow ? "Stop following playback" : "Follow playback"}
              active={follow}
              onClick={() => setFollow((value) => !value)}
            >
              <Crosshair className="size-4" strokeWidth={1.85} />
            </IconButton>

            <Segmented<ViewMode>
              value={view}
              onChange={setView}
              options={[
                { value: "timestamps", label: "Timed" },
                { value: "reading", label: "Reading" },
              ]}
            />
          </div>
        </div>
      ) : null}

      {/* ---------------- body ---------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-7">
        {job.status === "error" ? (
          <div className="rise mx-auto max-w-xl rounded-[var(--radius-card)] border border-danger/25 bg-danger-soft px-4 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-danger">Transcription failed</p>
                <p className="mt-1.5 break-words text-[12.5px] leading-[1.6] text-muted">
                  {job.error}
                </p>
                <Button size="sm" variant="secondary" className="mt-3.5" onClick={() => retry(job.id)}>
                  <RotateCcw className="size-3.5" />
                  Try again
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {job.status === "cancelled" ? (
          <div className="mx-auto flex max-w-xl flex-col items-center gap-3.5 py-16 text-center">
            <p className="text-[13.5px] text-muted">This run was cancelled.</p>
            <Button size="sm" onClick={() => retry(job.id)}>
              <RotateCcw className="size-3.5" />
              Run again
            </Button>
          </div>
        ) : null}

        {job.status === "queued" ? (
          <p className="py-16 text-center text-[13px] text-faint">Waiting for the queue…</p>
        ) : null}

        {transcript && segments.length === 0 ? (
          <p className="mx-auto max-w-xl py-16 text-center text-[13.5px] text-muted">
            No speech was detected in this file.
          </p>
        ) : null}

        {transcript && view === "timestamps" && segments.length > 0 ? (
          <ol className="mx-auto flex max-w-3xl flex-col gap-0.5">
            {visibleSegments.map((segment) => {
              const isActive = activeIndex === segment.id && !query;
              return (
                <li key={segment.id} ref={isActive ? activeRef : undefined} className="relative">
                  <button
                    onClick={() => seek(segment.start)}
                    className={clsx(
                      "group flex w-full gap-5 rounded-[12px] px-4 py-2.5 text-left",
                      "transition-all duration-200 [transition-timing-function:var(--ease-out-soft)]",
                      isActive
                        ? "bg-[linear-gradient(90deg,var(--active-soft),transparent_80%)]"
                        : "hover:bg-surface-2",
                    )}
                  >
                    <span
                      aria-hidden
                      className={clsx(
                        "absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-active transition-opacity duration-200",
                        isActive
                          ? "opacity-100 shadow-[0_0_12px_var(--active-line)]"
                          : "opacity-0",
                      )}
                    />
                    <span
                      className={clsx(
                        "mt-1 w-11 shrink-0 text-right font-mono text-[11.5px] tabular-nums transition-colors",
                        isActive ? "font-semibold text-active" : "text-faint group-hover:text-accent",
                      )}
                    >
                      {formatClock(segment.start)}
                    </span>
                    <span
                      className={clsx(
                        "text-[16px] leading-[1.75] tracking-[-0.012em] transition-colors",
                        isActive ? "font-medium text-ink" : "text-ink/72 group-hover:text-ink",
                      )}
                    >
                      {highlight(segment.text, query)}
                    </span>
                  </button>
                </li>
              );
            })}
            {query && visibleSegments.length === 0 ? (
              <p className="py-14 text-center text-[13px] text-faint">
                No lines match “{query}”.
              </p>
            ) : null}
          </ol>
        ) : null}

        {transcript && view === "reading" && segments.length > 0 ? (
          <article className="mx-auto flex max-w-[66ch] flex-col gap-6">
            {paragraphs.map((paragraph, index) => (
              <p
                key={index}
                className="text-[17px] leading-[1.82] tracking-[-0.013em] text-ink/85"
              >
                {highlight(paragraph, query)}
              </p>
            ))}
          </article>
        ) : null}
      </div>
    </section>
  );
}

export function EmptyTranscript() {
  // Bar heights and delays are hand-picked so the loop reads as speech, not a metronome.
  const bars = [
    { h: 22, d: "0ms" },
    { h: 40, d: "130ms" },
    { h: 58, d: "260ms" },
    { h: 34, d: "390ms" },
    { h: 48, d: "170ms" },
    { h: 26, d: "300ms" },
    { h: 44, d: "60ms" },
  ];

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div
        aria-hidden
        className="flex h-[70px] items-center gap-[7px]"
      >
        {bars.map((bar, i) => (
          <span
            key={i}
            className="eq-bar w-[7px] rounded-full bg-[linear-gradient(180deg,var(--accent-2),var(--accent))] opacity-70"
            style={{ height: bar.h, animationDelay: bar.d }}
          />
        ))}
      </div>

      <div className="max-w-md">
        <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.032em] text-ink">
          Transcribe audio without uploading it
        </h2>
        <p className="mt-3 text-[14.5px] leading-[1.65] text-muted">
          Drop a file from your computer and Whisper runs right here in the browser — no account,
          no API key, and no size limit on the recording.
        </p>
      </div>

      <dl className="grid max-w-lg grid-cols-3 gap-3 text-left">
        {[
          ["Private", "Audio never leaves this device"],
          ["Timestamped", "Click any line to jump there"],
          ["Exportable", "SRT, VTT, Markdown, JSON"],
        ].map(([term, detail]) => (
          <div
            key={term}
            className="rounded-[13px] border border-line bg-surface-2/60 px-3.5 py-3 lit"
          >
            <dt className="text-[12px] font-semibold tracking-[-0.01em] text-ink">{term}</dt>
            <dd className="mt-1 text-[11.5px] leading-[1.5] text-muted">{detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
