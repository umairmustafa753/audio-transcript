"use client";

import clsx from "clsx";
import type { Job } from "@/lib/types";
import { formatDuration } from "@/lib/format";
import { languageName } from "@/lib/languages";
import { AudioPlayer, type AudioPlayerApi } from "../AudioPlayer";
import { ExportMenu } from "../ExportMenu";

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

export function TranscriptHeader({
  job,
  url,
  peaks,
  player,
  wordCount,
  showPlayer,
}: {
  job: Job;
  url: string | null;
  peaks: Float32Array | null;
  player: AudioPlayerApi;
  wordCount: number;
  showPlayer: boolean;
}) {
  const transcript = job.transcript;

  return (
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
              <Meta label="Words" value={wordCount.toLocaleString()} />
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

      {showPlayer ? (
        <AudioPlayer
          url={url}
          peaks={peaks}
          fallbackDuration={transcript?.durationSec ?? job.durationSec ?? 0}
          player={player}
        />
      ) : null}
    </header>
  );
}
