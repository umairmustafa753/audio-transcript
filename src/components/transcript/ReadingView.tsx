"use client";

import { useMemo } from "react";
import type { Segment } from "@/lib/types";
import { toParagraphs } from "@/lib/format";
import { Highlight } from "./Highlight";

/** Timestamps dropped, segments re-flowed into paragraphs that break on pauses. */
export function ReadingView({ segments, query }: { segments: Segment[]; query: string }) {
  const paragraphs = useMemo(() => toParagraphs(segments), [segments]);

  return (
    <article className="mx-auto flex max-w-[66ch] flex-col gap-6">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="text-[17px] leading-[1.82] tracking-[-0.013em] text-ink/85">
          <Highlight text={paragraph} query={query} />
        </p>
      ))}
    </article>
  );
}
