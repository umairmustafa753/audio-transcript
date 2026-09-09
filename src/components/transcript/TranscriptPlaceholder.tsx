"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import type { Job } from "@/lib/types";
import { useApp } from "@/lib/store";
import { Button } from "../ui";

/**
 * What fills the transcript body when there are no lines to show. The four cases
 * are mutually exclusive — they key off distinct job statuses.
 */
export function TranscriptPlaceholder({ job }: { job: Job }) {
  const retry = useApp((s) => s.retry);

  if (job.status === "error") {
    return (
      <div className="rise mx-auto max-w-xl rounded-[var(--radius-card)] border border-danger/25 bg-danger-soft px-4 py-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-danger">Transcription failed</p>
            <p className="mt-1.5 break-words text-[12.5px] leading-[1.6] text-muted">
              {job.error}
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3.5"
              onClick={() => retry(job.id)}
            >
              <RotateCcw className="size-3.5" />
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (job.status === "cancelled") {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3.5 py-16 text-center">
        <p className="text-[13.5px] text-muted">This run was cancelled.</p>
        <Button size="sm" onClick={() => retry(job.id)}>
          <RotateCcw className="size-3.5" />
          Run again
        </Button>
      </div>
    );
  }

  if (job.status === "queued") {
    return <p className="py-16 text-center text-[13px] text-faint">Waiting for the queue…</p>;
  }

  if (job.transcript && job.transcript.segments.length === 0) {
    return (
      <p className="mx-auto max-w-xl py-16 text-center text-[13.5px] text-muted">
        No speech was detected in this file.
      </p>
    );
  }

  return null;
}
