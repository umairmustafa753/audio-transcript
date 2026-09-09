"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useApp } from "@/lib/store";
import { useOnEscape } from "@/lib/hooks";
import { AppearanceSection } from "./settings/AppearanceSection";
import { CloudModelSection } from "./settings/CloudModelSection";
import { EngineSection } from "./settings/EngineSection";
import { LocalModelSection } from "./settings/LocalModelSection";
import { PerformanceSection } from "./settings/PerformanceSection";
import { TranscriptionSection } from "./settings/TranscriptionSection";

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const provider = useApp((s) => s.settings.provider);
  const isLocal = provider === "local";

  useOnEscape(open, onClose);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={clsx(
          "fixed inset-0 z-40 bg-bg-deep/50 backdrop-blur-[3px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
        className={clsx(
          "glass fixed right-0 top-0 z-50 flex h-full w-full max-w-[410px] flex-col",
          "border-l border-line shadow-[var(--shadow-lg)]",
          "transition-transform duration-300 [transition-timing-function:var(--ease-out-soft)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-ink">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-[9px] p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <EngineSection />
          {isLocal ? <LocalModelSection /> : <CloudModelSection provider={provider} />}
          <TranscriptionSection />
          {isLocal ? <PerformanceSection /> : null}
          <AppearanceSection />
        </div>
      </aside>
    </>
  );
}
