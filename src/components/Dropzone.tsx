"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { AlertCircle, Upload } from "lucide-react";
import { useApp } from "@/lib/store";
import { ACCEPTED_EXTENSIONS } from "@/lib/audio";

export function Dropzone() {
  const addFiles = useApp((s) => s.addFiles);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const accept = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return;
      const files = Array.from(list);
      if (files.length === 0) return;
      setRejected(addFiles(files).rejected);
    },
    [addFiles],
  );

  // Window-level listeners so a drop anywhere on the page works.
  useEffect(() => {
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files");
    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      dragDepth.current += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer!.dropEffect = "copy";
    };
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      accept(event.dataTransfer!.files);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [accept]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={clsx(
            "group relative flex w-full flex-col items-center justify-center gap-2.5",
            "overflow-hidden rounded-[var(--radius-card)] px-4 py-7 text-center",
            "border border-dashed transition-all duration-200",
            "[transition-timing-function:var(--ease-out-soft)]",
            dragging
              ? "border-accent bg-accent-soft"
              : "border-line-strong bg-surface-2/50 hover:border-accent-line hover:bg-accent-soft/40",
          )}
        >
          <span
            className={clsx(
              "flex size-10 items-center justify-center rounded-[11px] transition-all duration-200",
              "[transition-timing-function:var(--ease-spring)]",
              dragging
                ? "scale-110 bg-[linear-gradient(145deg,var(--accent-2),var(--accent))] text-accent-ink shadow-[0_4px_14px_-4px_var(--accent-glow)]"
                : "bg-surface-3 text-muted group-hover:-translate-y-0.5 group-hover:text-accent",
            )}
          >
            <Upload className="size-[18px]" strokeWidth={1.9} />
          </span>

          <span className="flex flex-col gap-1">
            <span className="text-[13.5px] font-medium tracking-[-0.01em] text-ink">
              {dragging ? "Drop to transcribe" : "Choose audio files"}
            </span>
            <span className="text-[11.5px] leading-[1.5] text-muted">
              or drag them anywhere
              <span className="mx-1 text-faint">·</span>
              MP3, WAV, M4A, FLAC, OGG, MP4
            </span>
          </span>
        </button>

        {rejected.length > 0 ? (
          <ul className="flex flex-col gap-1 rounded-[11px] border border-danger/20 bg-danger-soft px-3 py-2">
            {rejected.map((reason) => (
              <li key={reason} className="flex items-start gap-1.5 text-[11.5px] leading-[1.5] text-danger">
                <AlertCircle className="mt-px size-3 shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={[...ACCEPTED_EXTENSIONS, "audio/*", "video/*"].join(",")}
        onChange={(event) => {
          accept(event.target.files);
          event.target.value = "";
        }}
      />

      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/60 backdrop-blur-sm">
          <div className="rise flex flex-col items-center gap-3 rounded-2xl border border-accent-line bg-surface px-12 py-10 text-center shadow-[var(--shadow-lg)]">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,var(--accent-2),var(--accent))] text-accent-ink shadow-[0_8px_24px_-6px_var(--accent-glow)]">
              <Upload className="size-6" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
                Drop audio to transcribe
              </p>
              <p className="mt-1 text-[12.5px] text-muted">Files are queued and run in order</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
