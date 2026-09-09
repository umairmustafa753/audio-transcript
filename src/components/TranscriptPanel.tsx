"use client";

import { useMemo, useRef, useState } from "react";
import type { Job } from "@/lib/types";
import { audioUrl, getMedia } from "@/lib/store";
import { isBusy } from "@/lib/jobStatus";
import { useAudioPlayer } from "./AudioPlayer";
import { LiveProgress } from "./transcript/LiveProgress";
import { ReadingView } from "./transcript/ReadingView";
import { SegmentList } from "./transcript/SegmentList";
import { TranscriptHeader } from "./transcript/TranscriptHeader";
import { TranscriptPlaceholder } from "./transcript/TranscriptPlaceholder";
import { TranscriptToolbar, type ViewMode } from "./transcript/TranscriptToolbar";
import { useReviewShortcuts } from "./transcript/useReviewShortcuts";
import { useTranscriptSearch } from "./transcript/useTranscriptSearch";

export function TranscriptPanel({ job }: { job: Job }) {
  const [view, setView] = useState<ViewMode>("timestamps");
  const [query, setQuery] = useState("");
  const [follow, setFollow] = useState(true);

  const url = useMemo(() => audioUrl(job.id), [job.id]);
  const peaks = getMedia(job.id)?.peaks ?? null;
  const player = useAudioPlayer(url);
  const searchRef = useRef<HTMLInputElement>(null);

  useReviewShortcuts(player, searchRef);

  const transcript = job.transcript;
  // Memoised so the empty-array fallback does not invalidate every derived value.
  const segments = useMemo(() => transcript?.segments ?? [], [transcript?.segments]);
  const { matches, visibleSegments } = useTranscriptSearch(segments, query);

  const wordCount = useMemo(
    () => (transcript?.text ?? "").split(/\s+/).filter(Boolean).length,
    [transcript?.text],
  );

  const busy = isBusy(job.status);
  const hasSegments = Boolean(transcript) && segments.length > 0;

  return (
    <section className="relative z-10 flex min-h-0 flex-1 flex-col">
      <TranscriptHeader
        job={job}
        url={url}
        peaks={peaks}
        player={player}
        wordCount={wordCount}
        showPlayer={Boolean(transcript) || busy}
      />

      {busy ? <LiveProgress job={job} /> : null}

      {hasSegments ? (
        <TranscriptToolbar
          query={query}
          onQueryChange={setQuery}
          matches={matches}
          searchRef={searchRef}
          follow={follow}
          onFollowChange={setFollow}
          view={view}
          onViewChange={setView}
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-7">
        <TranscriptPlaceholder job={job} />

        {hasSegments && view === "timestamps" ? (
          <SegmentList
            segments={segments}
            visibleSegments={visibleSegments}
            query={query}
            currentTime={player.currentTime}
            playing={player.playing}
            follow={follow}
            onSeek={player.seek}
          />
        ) : null}

        {hasSegments && view === "reading" ? (
          <ReadingView segments={segments} query={query} />
        ) : null}
      </div>
    </section>
  );
}
