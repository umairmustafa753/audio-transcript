"use client";

import clsx from "clsx";
import {
  AlertCircle,
  Check,
  CircleSlash,
  Clock,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { Job } from "@/lib/types";
import { useApp } from "@/lib/store";
import { formatBytes, formatDuration } from "@/lib/format";
import { IconButton, Progress, Spinner } from "./ui";

const BUSY: Job["status"][] = ["decoding", "loading-model", "transcribing"];

function StatusIcon({ job }: { job: Job }) {
  if (BUSY.includes(job.status)) return <Spinner className="size-3.5 text-accent" />;
  switch (job.status) {
    case "done":
      return (
        <span className="flex size-3.5 items-center justify-center rounded-full bg-ok-soft text-ok">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      );
    case "error":
      return <AlertCircle className="size-3.5 text-danger" strokeWidth={2} />;
    case "cancelled":
      return <CircleSlash className="size-3.5 text-faint" strokeWidth={2} />;
    default:
      return <Clock className="size-3.5 text-faint" strokeWidth={2} />;
  }
}

function statusLine(job: Job): string {
  if (BUSY.includes(job.status)) {
    return job.stage ? `${job.stage} · ${Math.round(job.progress * 100)}%` : "Working";
  }
  switch (job.status) {
    case "done": {
      const parts = [formatDuration(job.transcript?.durationSec ?? 0)];
      if (job.transcript) parts.push(`in ${formatDuration(job.transcript.elapsedMs / 1000)}`);
      return parts.join(" · ");
    }
    case "error":
      return job.error ?? "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Queued";
  }
}

function JobRow({ job, selected }: { job: Job; selected: boolean }) {
  // Separate selectors: returning a fresh object from one selector would break
  // zustand v5's snapshot caching.
  const select = useApp((s) => s.select);
  const remove = useApp((s) => s.remove);
  const retry = useApp((s) => s.retry);
  const cancel = useApp((s) => s.cancel);

  const busy = BUSY.includes(job.status);

  return (
    <li
      className={clsx(
        "rise group relative overflow-hidden rounded-[11px] border px-2.5 py-2",
        "transition-all duration-200 [transition-timing-function:var(--ease-out-soft)]",
        selected
          ? "border-accent-line bg-accent-soft"
          : "border-transparent hover:border-line hover:bg-surface-2",
      )}
    >
      {/* Accent rail marks the open transcript. */}
      <span
        aria-hidden
        className={clsx(
          "absolute inset-y-1.5 left-0 w-[2.5px] rounded-r-full bg-[linear-gradient(180deg,var(--accent-2),var(--accent))]",
          "transition-opacity duration-200",
          selected ? "opacity-100" : "opacity-0",
        )}
      />

      <div className="flex items-start gap-2.5 pl-1">
        <span className="mt-[3px] shrink-0">
          <StatusIcon job={job} />
        </span>

        <div className="min-w-0 flex-1">
          {/* The ::after overlay makes the row clickable without nesting
              the action buttons inside another button. */}
          <button
            onClick={() => select(job.id)}
            aria-current={selected ? "true" : undefined}
            className="block w-full text-left after:absolute after:inset-0 after:content-['']"
          >
            <span
              className="block truncate text-[12.5px] font-medium tracking-[-0.01em] text-ink"
              title={job.fileName}
            >
              {job.fileName}
            </span>
          </button>
          <p
            className={clsx(
              "mt-0.5 truncate text-[11px] tabular-nums",
              job.status === "error" ? "text-danger" : "text-muted",
            )}
            title={statusLine(job)}
          >
            {formatBytes(job.fileSize)}
            <span className="mx-1 text-faint">·</span>
            {statusLine(job)}
          </p>
        </div>

        <div className="relative z-10 flex shrink-0 items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          {busy ? (
            <IconButton label={`Cancel ${job.fileName}`} onClick={() => cancel(job.id)}>
              <X className="size-3.5" strokeWidth={2} />
            </IconButton>
          ) : null}
          {job.status === "error" || job.status === "cancelled" ? (
            <IconButton label={`Try ${job.fileName} again`} onClick={() => retry(job.id)}>
              <RotateCcw className="size-3.5" strokeWidth={2} />
            </IconButton>
          ) : null}
          <IconButton
            label={`Remove ${job.fileName}`}
            className="hover:text-danger"
            onClick={() => remove(job.id)}
          >
            <Trash2 className="size-3.5" strokeWidth={2} />
          </IconButton>
        </div>
      </div>

      {busy ? (
        <div className="relative z-10 mt-2 pl-1">
          <Progress
            value={job.progress}
            indeterminate={job.status === "loading-model" && job.progress < 0.02}
          />
        </div>
      ) : null}
    </li>
  );
}

export function JobList() {
  const jobs = useApp((s) => s.jobs);
  const selectedId = useApp((s) => s.selectedId);
  const clearAll = useApp((s) => s.clearAll);

  if (jobs.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-[11.5px] leading-[1.65] text-faint">
        Nothing queued yet.
        <br />
        Transcripts you create are saved in this browser.
      </p>
    );
  }

  const done = jobs.filter((j) => j.status === "done").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-1.5 pb-2">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint">
          Files
          <span className="ml-1.5 font-mono tabular-nums normal-case tracking-normal">
            {done}/{jobs.length}
          </span>
        </h2>
        <button
          onClick={clearAll}
          className="rounded-md px-1 text-[11px] font-medium text-faint transition-colors hover:text-danger"
        >
          Clear all
        </button>
      </div>

      <ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1 pb-1">
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} selected={job.id === selectedId} />
        ))}
      </ul>
    </div>
  );
}
