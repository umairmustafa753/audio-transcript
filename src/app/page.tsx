"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Dropzone } from "@/components/Dropzone";
import { JobList } from "@/components/JobList";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SidebarFooter } from "@/components/SidebarFooter";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { EmptyTranscript } from "@/components/transcript/EmptyTranscript";
import { useApp } from "@/lib/store";
import { isBusy } from "@/lib/jobStatus";
import { isTypingTarget, useThemeAttribute, useWindowKeyDown } from "@/lib/hooks";

export default function Page() {
  const hydrate = useApp((s) => s.hydrate);
  const hydrated = useApp((s) => s.hydrated);
  const jobs = useApp((s) => s.jobs);
  const selectedId = useApp((s) => s.selectedId);
  const theme = useApp((s) => s.settings.theme);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useThemeAttribute(theme);

  // Warn before a reload throws away work in progress.
  const working = jobs.some((job) => isBusy(job.status));
  useEffect(() => {
    if (!working) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [working]);

  useWindowKeyDown((event) => {
    if (isTypingTarget(event.target)) return;
    if (event.key === "," && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      setSettingsOpen(true);
    }
  });

  const selected = jobs.find((job) => job.id === selectedId) ?? null;

  return (
    <div className="canvas grain relative flex h-dvh flex-col overflow-hidden">
      <Header onOpenSettings={() => setSettingsOpen(true)} />

      {/* Two floating panels with the canvas showing between and around them. */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 lg:flex-row">
        <aside className="panel flex w-full shrink-0 flex-col gap-3 overflow-hidden p-3 lg:w-[326px]">
          <Dropzone />
          {hydrated ? (
            <JobList />
          ) : (
            <p className="px-3 py-8 text-center text-[11.5px] text-faint">
              Loading saved transcripts…
            </p>
          )}
          <SidebarFooter />
        </aside>

        <main className="panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {selected ? <TranscriptPanel key={selected.id} job={selected} /> : <EmptyTranscript />}
        </main>
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
