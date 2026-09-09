"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import type { Transcript } from "@/lib/types";
import { EXPORT_FORMATS, baseName, download, serialize } from "@/lib/format";
import { Button } from "./ui";

export function ExportMenu({
  transcript,
  fileName,
}: {
  transcript: Transcript;
  fileName: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const hasSegments = transcript.segments.length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(serialize(transcript, fileName, "txt"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard can be blocked; the download path still works */
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" variant="secondary" onClick={copy}>
        {copied ? (
          <Check className="size-3.5 text-ok" strokeWidth={2.4} />
        ) : (
          <Copy className="size-3.5" strokeWidth={1.9} />
        )}
        {copied ? "Copied" : "Copy"}
      </Button>

      <div ref={containerRef} className="relative">
        <Button
          size="sm"
          variant="primary"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <Download className="size-3.5" strokeWidth={1.9} />
          Export
        </Button>

        {open ? (
          <div
            role="menu"
            className="rise absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-[13px] border border-line bg-surface p-1 shadow-[var(--shadow-lg)]"
          >
            {EXPORT_FORMATS.map((format) => {
              const disabled = format.needsSegments && !hasSegments;
              return (
                <button
                  key={format.id}
                  role="menuitem"
                  disabled={disabled}
                  onClick={() => {
                    download(
                      serialize(transcript, fileName, format.id),
                      `${baseName(fileName)}.${format.ext}`,
                      format.mime,
                    );
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-[9px] px-2.5 py-[7px] text-left text-[12.5px] text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent"
                >
                  <span>{format.label}</span>
                  <span className="rounded-md bg-surface-2 px-1.5 py-px font-mono text-[10.5px] text-faint">
                    .{format.ext}
                  </span>
                </button>
              );
            })}
            {!hasSegments ? (
              <p className="mt-1 border-t border-line px-2.5 pb-1 pt-2 text-[11px] leading-[1.55] text-faint">
                Subtitle formats need timestamps, which this model did not return.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
