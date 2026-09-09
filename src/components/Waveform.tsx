"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/format";

interface WaveformProps {
  peaks: Float32Array | null;
  durationSec: number;
  currentTime: number;
  onSeek: (time: number) => void;
  height?: number;
}

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

const BAR = 3;
const GAP = 2;

export function Waveform({
  peaks,
  durationSec,
  currentTime,
  onSeek,
  height = 96,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    if (w === 0) return;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);

    const accent = cssVar(canvas, "--accent", "#8b6dff");
    const accent2 = cssVar(canvas, "--accent-2", "#b39aff");
    const idle = cssVar(canvas, "--wave-idle", "#55556a");

    const mid = height / 2;
    const maxBar = height - 10;
    const bars = Math.max(1, Math.floor((w + GAP) / (BAR + GAP)));
    const progressX = durationSec > 0 ? (currentTime / durationSec) * w : 0;
    const hoverX = hover !== null ? hover * w : null;

    // A lit band behind everything that has played.
    if (progressX > 0) {
      const wash = ctx.createLinearGradient(0, 0, 0, height);
      wash.addColorStop(0, "transparent");
      wash.addColorStop(0.5, accent);
      wash.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, progressX, height);
      ctx.globalAlpha = 1;
    }

    // Played bars are brightest at the centre line, so the waveform reads as lit.
    const played = ctx.createLinearGradient(0, mid - maxBar / 2, 0, mid + maxBar / 2);
    played.addColorStop(0, accent2);
    played.addColorStop(0.5, accent);
    played.addColorStop(1, accent2);

    for (let i = 0; i < bars; i++) {
      const x = i * (BAR + GAP);

      let amp = 0.045;
      if (peaks && peaks.length > 0) {
        const from = Math.floor((i / bars) * peaks.length);
        const to = Math.max(from + 1, Math.floor(((i + 1) / bars) * peaks.length));
        let sum = 0;
        for (let p = from; p < to && p < peaks.length; p++) sum += peaks[p];
        // A gentle curve keeps quiet passages visible without flattening loud ones.
        amp = Math.max(0.06, Math.pow(sum / (to - from), 0.6));
      }

      let h = Math.max(3, amp * maxBar);

      // Bars swell under the cursor.
      if (hoverX !== null) {
        const d = Math.abs(x + BAR / 2 - hoverX);
        if (d < 34) h = Math.min(maxBar, h * (1 + 0.4 * (1 - d / 34)));
      }

      const isPlayed = x + BAR <= progressX;
      ctx.fillStyle = isPlayed ? played : idle;
      ctx.globalAlpha = isPlayed ? 1 : 0.78;
      ctx.beginPath();
      ctx.roundRect(x, mid - h / 2, BAR, h, BAR / 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Soften the outer edges so the waveform sits on the panel rather than on top of it.
    const fade = ctx.createLinearGradient(0, 0, 0, height);
    fade.addColorStop(0, "rgba(0,0,0,0.32)");
    fade.addColorStop(0.13, "rgba(0,0,0,0)");
    fade.addColorStop(0.87, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(0,0,0,0.32)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, height);
    ctx.globalCompositeOperation = "source-over";

    // Hover guide.
    if (hoverX !== null) {
      ctx.fillStyle = idle;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(Math.round(hoverX), 0, 1, height);
      ctx.globalAlpha = 1;
    }

    // Playhead: a glowing hairline with a cap at each end.
    if (durationSec > 0) {
      const px = Math.max(1, Math.min(w - 1, progressX));
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 14;
      ctx.fillStyle = accent2;
      ctx.fillRect(px - 1, 0, 2, height);
      ctx.restore();

      ctx.fillStyle = accent2;
      ctx.beginPath();
      ctx.roundRect(px - 3, 0, 6, 5, 2.5);
      ctx.roundRect(px - 3, height - 5, 6, 5, 2.5);
      ctx.fill();
    }
  }, [peaks, durationSec, currentTime, height, hover]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const parent = canvasRef.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => {
      setWidth(parent.clientWidth);
      draw();
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [draw]);

  const ratioFrom = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  };

  const hoverTime = hover !== null ? hover * durationSec : 0;
  const tipLeft = hover !== null ? Math.min(Math.max(hover * width, 26), Math.max(26, width - 26)) : 0;

  return (
    <div
      className="group/wave relative w-full cursor-pointer select-none"
      style={{ height }}
      onClick={(event) => durationSec > 0 && onSeek(ratioFrom(event) * durationSec)}
      onMouseMove={(event) => setHover(ratioFrom(event))}
      onMouseLeave={() => setHover(null)}
      role="slider"
      aria-label="Audio position"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationSec)}
      aria-valuenow={Math.round(currentTime)}
      aria-valuetext={`${formatClock(currentTime)} of ${formatClock(durationSec)}`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") onSeek(Math.max(0, currentTime - 5));
        if (event.key === "ArrowRight") onSeek(Math.min(durationSec, currentTime + 5));
        if (event.key === "Home") onSeek(0);
      }}
    >
      <canvas ref={canvasRef} className="block" />

      {hover !== null && durationSec > 0 ? (
        <span
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-ink shadow-[var(--shadow-md)]"
          style={{ left: tipLeft }}
        >
          {formatClock(hoverTime)}
        </span>
      ) : null}
    </div>
  );
}
