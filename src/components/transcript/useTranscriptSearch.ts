"use client";

import { useMemo } from "react";
import type { Segment } from "@/lib/types";

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    count += 1;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return count;
}

/** Filter the transcript to matching lines and count every hit inside them. */
export function useTranscriptSearch(segments: Segment[], query: string) {
  const needle = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!needle) return 0;
    return segments.reduce(
      (total, segment) => total + countOccurrences(segment.text.toLowerCase(), needle),
      0,
    );
  }, [segments, needle]);

  const visibleSegments = useMemo(() => {
    if (!needle) return segments;
    return segments.filter((segment) => segment.text.toLowerCase().includes(needle));
  }, [segments, needle]);

  return { matches, visibleSegments };
}
