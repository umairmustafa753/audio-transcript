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

const BAR = 3;
const GAP = 2;
/** Floor amplitudes so silence still shows a hairline rather than nothing. */
const SILENT_AMP = 0.045;
const MIN_AMP = 0.06;
/** A gentle curve keeps quiet passages visible without flattening loud ones. */
const AMP_CURVE = 0.6;
const MIN_BAR_HEIGHT = 3;
/** Bars within this many pixels of the cursor swell, by up to HOVER_SWELL. */
const HOVER_RADIUS = 34;
const HOVER_SWELL = 0.4;
const NUDGE_SECONDS = 5;

interface Palette {
  accent: string;
  accent2: string;
  idle: string;
}

/** Layout derived once per paint and shared by every drawing pass. */
interface Geometry {
  width: number;
  height: number;
  mid: number;
  maxBar: number;
  barCount: number;
  progressX: number;
  hoverX: number | null;
}

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

function readPalette(canvas: HTMLCanvasElement): Palette {
  return {
    accent: cssVar(canvas, "--accent", "#8b6dff"),
    accent2: cssVar(canvas, "--accent-2", "#b39aff"),
    idle: cssVar(canvas, "--wave-idle", "#55556a"),
  };
}

/** Mean peak across the slice of the envelope this bar represents. */
function barAmplitude(peaks: Float32Array | null, index: number, barCount: number): number {
  if (!peaks || peaks.length === 0) return SILENT_AMP;
  const from = Math.floor((index / barCount) * peaks.length);
  const to = Math.max(from + 1, Math.floor(((index + 1) / barCount) * peaks.length));
  let sum = 0;
  for (let p = from; p < to && p < peaks.length; p++) sum += peaks[p];
  return Math.max(MIN_AMP, Math.pow(sum / (to - from), AMP_CURVE));
}

/** A lit band behind everything that has played. */
function drawProgressWash(ctx: CanvasRenderingContext2D, geo: Geometry, palette: Palette) {
  if (geo.progressX <= 0) return;
  const wash = ctx.createLinearGradient(0, 0, 0, geo.height);
  wash.addColorStop(0, "transparent");
  wash.addColorStop(0.5, palette.accent);
  wash.addColorStop(1, "transparent");
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, geo.progressX, geo.height);
  ctx.globalAlpha = 1;
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  geo: Geometry,
  palette: Palette,
  peaks: Float32Array | null,
) {
  // Played bars are brightest at the centre line, so the waveform reads as lit.
  const played = ctx.createLinearGradient(0, geo.mid - geo.maxBar / 2, 0, geo.mid + geo.maxBar / 2);
  played.addColorStop(0, palette.accent2);
  played.addColorStop(0.5, palette.accent);
  played.addColorStop(1, palette.accent2);

  for (let i = 0; i < geo.barCount; i++) {
    const x = i * (BAR + GAP);
    let h = Math.max(MIN_BAR_HEIGHT, barAmplitude(peaks, i, geo.barCount) * geo.maxBar);

    // Bars swell under the cursor.
    if (geo.hoverX !== null) {
      const distance = Math.abs(x + BAR / 2 - geo.hoverX);
      if (distance < HOVER_RADIUS) {
        h = Math.min(geo.maxBar, h * (1 + HOVER_SWELL * (1 - distance / HOVER_RADIUS)));
      }
    }

    const isPlayed = x + BAR <= geo.progressX;
    ctx.fillStyle = isPlayed ? played : palette.idle;
    ctx.globalAlpha = isPlayed ? 1 : 0.78;
    ctx.beginPath();
    ctx.roundRect(x, geo.mid - h / 2, BAR, h, BAR / 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Soften the outer edges so the waveform sits on the panel rather than on top of it. */
function drawEdgeFade(ctx: CanvasRenderingContext2D, geo: Geometry) {
  const fade = ctx.createLinearGradient(0, 0, 0, geo.height);
  fade.addColorStop(0, "rgba(0,0,0,0.32)");
  fade.addColorStop(0.13, "rgba(0,0,0,0)");
  fade.addColorStop(0.87, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, geo.width, geo.height);
  ctx.globalCompositeOperation = "source-over";
}

function drawHoverGuide(ctx: CanvasRenderingContext2D, geo: Geometry, palette: Palette) {
  if (geo.hoverX === null) return;
  ctx.fillStyle = palette.idle;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(Math.round(geo.hoverX), 0, 1, geo.height);
  ctx.globalAlpha = 1;
}

/** A glowing hairline with a cap at each end. */
function drawPlayhead(ctx: CanvasRenderingContext2D, geo: Geometry, palette: Palette) {
  const px = Math.max(1, Math.min(geo.width - 1, geo.progressX));

  ctx.save();
  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = 14;
  ctx.fillStyle = palette.accent2;
  ctx.fillRect(px - 1, 0, 2, geo.height);
  ctx.restore();

  ctx.fillStyle = palette.accent2;
  ctx.beginPath();
  ctx.roundRect(px - 3, 0, 6, 5, 2.5);
  ctx.roundRect(px - 3, geo.height - 5, 6, 5, 2.5);
  ctx.fill();
}

/** Size the backing store to the device pixel ratio. Returns the CSS width. */
function fitCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number) {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(cssWidth * dpr);
  const h = Math.round(cssHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }
  return dpr;
}

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

    const cssWidth = parent.clientWidth;
    if (cssWidth === 0) return;

    const dpr = fitCanvas(canvas, cssWidth, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, height);

    const palette = readPalette(canvas);
    const geo: Geometry = {
      width: cssWidth,
      height,
      mid: height / 2,
      maxBar: height - 10,
      barCount: Math.max(1, Math.floor((cssWidth + GAP) / (BAR + GAP))),
      progressX: durationSec > 0 ? (currentTime / durationSec) * cssWidth : 0,
      hoverX: hover !== null ? hover * cssWidth : null,
    };

    drawProgressWash(ctx, geo, palette);
    drawBars(ctx, geo, palette, peaks);
    drawEdgeFade(ctx, geo);
    drawHoverGuide(ctx, geo, palette);
    if (durationSec > 0) drawPlayhead(ctx, geo, palette);
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
  const tipLeft =
    hover !== null ? Math.min(Math.max(hover * width, 26), Math.max(26, width - 26)) : 0;

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
        if (event.key === "ArrowLeft") onSeek(Math.max(0, currentTime - NUDGE_SECONDS));
        if (event.key === "ArrowRight")
          onSeek(Math.min(durationSec, currentTime + NUDGE_SECONDS));
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
