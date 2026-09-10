"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { getMedia, useApp } from "@/lib/store";
import { storableJob } from "@/lib/db";
import { BACKUP_EXTENSION, buildBackup, readBackup } from "@/lib/backup";
import { downloadBlob } from "@/lib/format";
import { Button, Spinner } from "../ui";
import { Section } from "./Section";

type Status = { tone: "ok" | "error"; text: string } | null;

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function BackupSection() {
  const jobs = useApp((s) => s.jobs);
  const hydrated = useApp((s) => s.hydrated);
  const processing = useApp((s) => s.processing);
  const importBackup = useApp((s) => s.importBackup);
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  function exportAll() {
    const records = jobs.map((job) => {
      const entry = getMedia(job.id);
      return { job: storableJob(job), file: entry?.file ?? null, peaks: entry?.peaks ?? null };
    });
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(
      buildBackup(records, useApp.getState().settings),
      `scribe-backup-${date}${BACKUP_EXTENSION}`,
    );
    setStatus({ tone: "ok", text: `Exported ${plural(records.length, "item")}.` });
  }

  async function importFile(file: File) {
    setImporting(true);
    setStatus(null);
    try {
      const { added, skipped } = await importBackup(await readBackup(file));
      setStatus({
        tone: "ok",
        text:
          added === 0 && skipped > 0
            ? "Everything in this backup is already here."
            : `Imported ${plural(added, "item")}.` +
              (skipped > 0 ? ` Skipped ${skipped} already here.` : ""),
      });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Section title="Backup">
      <p className="text-[11.5px] leading-[1.55] text-muted">
        Moves your transcripts, their audio and your settings to another browser or to the
        desktop app. API keys are not included.
      </p>

      <div className="flex gap-2">
        <Button size="sm" onClick={exportAll} disabled={!hydrated || jobs.length === 0}>
          <Download className="size-3.5" strokeWidth={2} />
          Export backup
        </Button>
        {/* Imported settings can switch the compute backend, which restarts the
            engine — so never mid-transcription. */}
        <Button
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={!hydrated || importing || processing}
          title={processing ? "Available once the queue has finished" : undefined}
        >
          {importing ? <Spinner /> : <Upload className="size-3.5" strokeWidth={2} />}
          Import backup
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={BACKUP_EXTENSION}
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importFile(file);
          }}
        />
      </div>

      {status ? (
        <p
          role="status"
          className={
            status.tone === "error"
              ? "text-[11.5px] leading-[1.55] text-danger"
              : "text-[11.5px] leading-[1.55] text-ok"
          }
        >
          {status.text}
        </p>
      ) : null}
    </Section>
  );
}
