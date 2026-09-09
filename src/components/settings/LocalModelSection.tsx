"use client";

import { useState } from "react";
import { Check, Download } from "lucide-react";
import { useApp } from "@/lib/store";
import { LOCAL_MODELS, noteFor } from "@/lib/models";
import { formatBytes } from "@/lib/format";
import { Button, Field, Progress, Select, Spinner } from "../ui";
import { Section } from "./Section";

/** Progress readout for the one-time weight download. */
function DownloadProgress() {
  const download = useApp((s) => s.download);
  if (!download) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <Progress value={download.progress} />
      <p className="truncate font-mono text-[10.5px] tabular-nums text-faint">
        {download.file} · {formatBytes(download.loaded)}
        {download.total ? ` / ${formatBytes(download.total)}` : ""}
      </p>
    </div>
  );
}

export function LocalModelSection() {
  const localModel = useApp((s) => s.settings.localModel);
  const update = useApp((s) => s.updateSettings);
  const warmModel = useApp((s) => s.warmModel);

  const [warming, setWarming] = useState(false);
  const [warmError, setWarmError] = useState<string | null>(null);
  const [warmed, setWarmed] = useState(false);

  const prefetch = async () => {
    setWarming(true);
    setWarmError(null);
    setWarmed(false);
    try {
      await warmModel();
      setWarmed(true);
    } catch (error) {
      setWarmError(error instanceof Error ? error.message : String(error));
    } finally {
      setWarming(false);
    }
  };

  return (
    <Section title="Model">
      <Field label="Whisper build" hint={noteFor("local", localModel)}>
        <Select
          value={localModel}
          onChange={(event) => {
            setWarmed(false);
            update({ localModel: event.target.value });
          }}
        >
          {LOCAL_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label} — {model.size}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-col gap-2">
        <Button variant="secondary" size="sm" onClick={prefetch} disabled={warming}>
          {warming ? (
            <Spinner />
          ) : warmed ? (
            <Check className="size-3.5 text-ok" strokeWidth={2.4} />
          ) : (
            <Download className="size-3.5" strokeWidth={1.9} />
          )}
          {warming ? "Downloading…" : warmed ? "Ready to use" : "Download model now"}
        </Button>

        {warming ? <DownloadProgress /> : null}

        {warmError ? (
          <p className="text-[11.5px] leading-[1.55] text-danger">{warmError}</p>
        ) : (
          <p className="text-[11.5px] leading-[1.55] text-muted">
            Weights are cached by the browser, so this is a one-time download per model.
          </p>
        )}
      </div>
    </Section>
  );
}
