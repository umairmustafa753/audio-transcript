"use client";

import { Cloud, ShieldCheck } from "lucide-react";
import { useApp } from "@/lib/store";

/**
 * Where the audio actually goes is the one thing worth stating permanently —
 * it changes with the engine, and it is the reason to use this over a web tool.
 */
export function SidebarFooter() {
  const provider = useApp((s) => s.settings.provider);
  const local = provider === "local";

  return (
    <footer className="mt-auto flex items-center gap-2 border-t border-line px-2 pt-3 pb-0.5">
      <span
        className={
          local
            ? "flex size-5 shrink-0 items-center justify-center rounded-md bg-ok-soft text-ok"
            : "flex size-5 shrink-0 items-center justify-center rounded-md bg-surface-3 text-muted"
        }
      >
        {local ? (
          <ShieldCheck className="size-3" strokeWidth={2.1} />
        ) : (
          <Cloud className="size-3" strokeWidth={2.1} />
        )}
      </span>
      <p className="text-[10.5px] leading-[1.45] text-faint">
        {local ? (
          <>
            Audio stays on this device.
            <br />
            Nothing is uploaded.
          </>
        ) : (
          <>
            Files are uploaded to {provider}
            <br />
            for transcription.
          </>
        )}
      </p>
    </footer>
  );
}
