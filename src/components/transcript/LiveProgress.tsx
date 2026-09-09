"use client";

import { X } from "lucide-react";
import type { Job } from "@/lib/types";
import { useApp } from "@/lib/store";
import { Button, LiveDot, Progress } from "../ui";

/** Stage, percentage, tokens/second and the streaming partial text, while a job runs. */
export function LiveProgress({ job }: { job: Job }) {
  const tps = useApp((s) => s.tps);
  const cancel = useApp((s) => s.cancel);

  return (
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

      <Progress className="mt-2.5" value={job.progress} indeterminate={job.progress < 0.02} />

      {job.partial ? (
        <p className="mt-3 max-h-28 overflow-y-auto whitespace-pre-wrap text-[13px] leading-[1.65] text-muted">
          {job.partial}
          <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 rounded-full bg-accent breathe" />
        </p>
      ) : null}
    </div>
  );
}
