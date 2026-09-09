"use client";

import { AudioLines, Cloud, Cpu, Settings2, Zap } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatBytes } from "@/lib/format";
import { IconButton, LiveDot, Progress } from "./ui";

export function Header({ onOpenSettings }: { onOpenSettings: () => void }) {
  const settings = useApp((s) => s.settings);
  const download = useApp((s) => s.download);
  const processing = useApp((s) => s.processing);

  const modelName =
    settings.provider === "local" ? settings.localModel.split("/").pop() : settings.cloudModel;
  const Icon = settings.provider === "local" ? Cpu : settings.provider === "groq" ? Zap : Cloud;

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center gap-3 px-5">
      <div className="flex items-center gap-2.5">
        <span className="relative flex size-9 items-center justify-center rounded-[12px] bg-[linear-gradient(145deg,var(--accent-2),var(--accent))] text-accent-ink shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_8px_22px_-6px_var(--accent-glow)]">
          <AudioLines className="size-[19px]" strokeWidth={2.15} />
        </span>
        <div className="leading-tight">
          <h1 className="text-[15px] font-semibold tracking-[-0.03em] text-ink">Scribe</h1>
          <p className="text-[11px] tracking-[-0.005em] text-faint">Audio to text, on your machine</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        {download ? (
          <div className="hidden w-60 flex-col gap-1.5 sm:flex">
            <span className="flex items-center justify-between gap-2 font-mono text-[10.5px] tabular-nums text-muted">
              <span className="truncate">{download.file}</span>
              <span className="shrink-0 text-faint">
                {formatBytes(download.loaded)}
                {download.total ? ` / ${formatBytes(download.total)}` : ""}
              </span>
            </span>
            <Progress value={download.progress} />
          </div>
        ) : null}

        <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-2.5 pr-3 text-[11.5px] font-medium text-muted shadow-[var(--inset-top)] md:inline-flex">
          {processing ? <LiveDot /> : <Icon className="size-3 text-faint" strokeWidth={2} />}
          <span className="font-mono tracking-tight text-ink">{modelName}</span>
        </span>

        <IconButton label="Settings" onClick={onOpenSettings}>
          <Settings2 className="size-[17px]" strokeWidth={1.75} />
        </IconButton>
      </div>
    </header>
  );
}
