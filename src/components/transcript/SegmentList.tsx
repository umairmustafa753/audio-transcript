"use client";

import { useEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import type { Segment } from "@/lib/types";
import { findActiveSegment } from "@/lib/segments";
import { formatClock } from "@/lib/format";
import { Highlight } from "./Highlight";

function SegmentRow({
  segment,
  active,
  query,
  onSeek,
  rowRef,
}: {
  segment: Segment;
  active: boolean;
  query: string;
  onSeek: (time: number) => void;
  rowRef?: React.Ref<HTMLLIElement>;
}) {
  return (
    <li ref={rowRef} className="relative">
      <button
        onClick={() => onSeek(segment.start)}
        className={clsx(
          "group flex w-full gap-5 rounded-[12px] px-4 py-2.5 text-left",
          "transition-all duration-200 [transition-timing-function:var(--ease-out-soft)]",
          active
            ? "bg-[linear-gradient(90deg,var(--active-soft),transparent_80%)]"
            : "hover:bg-surface-2",
        )}
      >
        <span
          aria-hidden
          className={clsx(
            "absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-active transition-opacity duration-200",
            active ? "opacity-100 shadow-[0_0_12px_var(--active-line)]" : "opacity-0",
          )}
        />
        <span
          className={clsx(
            "mt-1 w-11 shrink-0 text-right font-mono text-[11.5px] tabular-nums transition-colors",
            active ? "font-semibold text-active" : "text-faint group-hover:text-accent",
          )}
        >
          {formatClock(segment.start)}
        </span>
        <span
          className={clsx(
            "text-[16px] leading-[1.75] tracking-[-0.012em] transition-colors",
            active ? "font-medium text-ink" : "text-ink/72 group-hover:text-ink",
          )}
        >
          <Highlight text={segment.text} query={query} />
        </span>
      </button>
    </li>
  );
}

export function SegmentList({
  segments,
  visibleSegments,
  query,
  currentTime,
  playing,
  follow,
  onSeek,
}: {
  segments: Segment[];
  visibleSegments: Segment[];
  query: string;
  currentTime: number;
  playing: boolean;
  follow: boolean;
  onSeek: (time: number) => void;
}) {
  const activeRef = useRef<HTMLLIElement>(null);

  const activeIndex = useMemo(
    () => (segments.length === 0 ? -1 : findActiveSegment(segments, currentTime)),
    [segments, currentTime],
  );

  // Keep the spoken line in view while playing, unless the user turned it off.
  useEffect(() => {
    if (!follow || !playing) return;
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex, follow, playing]);

  return (
    <ol className="mx-auto flex max-w-3xl flex-col gap-0.5">
      {visibleSegments.map((segment) => {
        const active = activeIndex === segment.id && !query;
        return (
          <SegmentRow
            key={segment.id}
            segment={segment}
            active={active}
            query={query}
            onSeek={onSeek}
            rowRef={active ? activeRef : undefined}
          />
        );
      })}
      {query && visibleSegments.length === 0 ? (
        <p className="py-14 text-center text-[13px] text-faint">No lines match “{query}”.</p>
      ) : null}
    </ol>
  );
}
