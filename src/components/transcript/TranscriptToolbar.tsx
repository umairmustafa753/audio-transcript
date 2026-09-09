"use client";

import clsx from "clsx";
import { Crosshair, Search, X } from "lucide-react";
import { IconButton, Segmented } from "../ui";

export type ViewMode = "timestamps" | "reading";

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "timestamps", label: "Timed" },
  { value: "reading", label: "Reading" },
];

export function TranscriptToolbar({
  query,
  onQueryChange,
  matches,
  searchRef,
  follow,
  onFollowChange,
  view,
  onViewChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  matches: number;
  searchRef: React.RefObject<HTMLInputElement | null>;
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-line bg-panel/80 px-7 py-3 backdrop-blur-xl">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search this transcript…"
          className={clsx(
            "h-8 w-full rounded-[9px] border border-line bg-surface-2 pl-8 pr-8",
            "text-[12.5px] text-ink placeholder:text-faint shadow-[var(--inset-top)]",
            "transition-colors hover:border-line-strong",
          )}
        />
        {query ? (
          <button
            onClick={() => onQueryChange("")}
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
          onClick={() => onFollowChange(!follow)}
        >
          <Crosshair className="size-4" strokeWidth={1.85} />
        </IconButton>

        <Segmented<ViewMode> value={view} onChange={onViewChange} options={VIEW_OPTIONS} />
      </div>
    </div>
  );
}
