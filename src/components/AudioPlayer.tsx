"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";
import { formatClock } from "@/lib/format";
import { Waveform } from "./Waveform";
import { IconButton } from "./ui";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export interface PlayerApi {
  currentTime: number;
  duration: number;
  playing: boolean;
  seek: (time: number) => void;
  toggle: () => void;
}

export function useAudioPlayer(url: string | null): PlayerApi & {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  rate: number;
  setRate: (rate: number) => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
} {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const [muted, setMutedState] = useState(false);

  // A new source means a fresh timeline. Resetting during render (rather than in
  // an effect) avoids a frame that shows the previous track's position.
  const [lastUrl, setLastUrl] = useState(url);
  if (url !== lastUrl) {
    setLastUrl(url);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let frame = 0;
    const tick = () => {
      setCurrentTime(audio.currentTime);
      frame = requestAnimationFrame(tick);
    };

    const onPlay = () => {
      setPlaying(true);
      frame = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(frame);
      setCurrentTime(audio.currentTime);
    };
    const onLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const onSeeked = () => setCurrentTime(audio.currentTime);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onPause);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("seeked", onSeeked);
    return () => {
      cancelAnimationFrame(frame);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onPause);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("seeked", onSeeked);
    };
  }, [url]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Number.isFinite(audio.duration) ? Math.min(time, audio.duration) : time);
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }, []);

  const setRate = useCallback((next: number) => {
    setRateState(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }, []);

  const setMuted = useCallback((next: boolean) => {
    setMutedState(next);
    if (audioRef.current) audioRef.current.muted = next;
  }, []);

  return { audioRef, currentTime, duration, playing, seek, toggle, rate, setRate, muted, setMuted };
}

interface AudioPlayerProps {
  url: string | null;
  peaks: Float32Array | null;
  fallbackDuration: number;
  player: ReturnType<typeof useAudioPlayer>;
}

export function AudioPlayer({ url, peaks, fallbackDuration, player }: AudioPlayerProps) {
  const { audioRef, currentTime, duration, playing, seek, toggle, rate, setRate, muted, setMuted } =
    player;
  const total = duration || fallbackDuration;

  if (!url) {
    return (
      <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface-2 px-3.5 py-3 lit">
        <AudioLines className="mt-px size-4 shrink-0 text-faint" strokeWidth={1.6} />
        <p className="text-[12.5px] leading-[1.55] text-muted">
          The original audio is not stored for this transcript, so playback is unavailable.
          Add the file again to listen along.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />

      <div className="relative overflow-hidden rounded-[16px] border border-line bg-[linear-gradient(180deg,var(--surface-2),var(--surface))] px-4 py-3 lit">
        <Waveform
          peaks={peaks}
          durationSec={total}
          currentTime={currentTime}
          onSeek={seek}
          height={96}
        />
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause (Space)" : "Play (Space)"}
          className={clsx(
            "group flex size-[52px] shrink-0 items-center justify-center rounded-full",
            "bg-[linear-gradient(180deg,var(--accent-2),var(--accent))] text-accent-ink",
            "shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_10px_30px_-8px_var(--accent-glow)]",
            "transition-transform duration-150 [transition-timing-function:var(--ease-spring)]",
            "hover:scale-105 active:scale-95",
          )}
        >
          {playing ? (
            <Pause className="size-5" fill="currentColor" strokeWidth={0} />
          ) : (
            <Play className="ml-0.5 size-5" fill="currentColor" strokeWidth={0} />
          )}
        </button>

        <div className="flex items-center">
          <IconButton label="Back 10 seconds" onClick={() => seek(currentTime - 10)}>
            <RotateCcw className="size-4" strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Forward 10 seconds" onClick={() => seek(currentTime + 10)}>
            <RotateCw className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>

        <span className="ml-1 font-mono text-[13.5px] tabular-nums tracking-tight">
          <span className="text-ink">{formatClock(currentTime)}</span>
          <span className="mx-1.5 text-faint">/</span>
          <span className="text-muted">{formatClock(total)}</span>
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <IconButton label={muted ? "Unmute" : "Mute"} onClick={() => setMuted(!muted)}>
            {muted ? (
              <VolumeX className="size-4" strokeWidth={1.75} />
            ) : (
              <Volume2 className="size-4" strokeWidth={1.75} />
            )}
          </IconButton>

          <div className="relative">
            <select
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
              aria-label="Playback speed"
              className="h-8 appearance-none rounded-full border border-line bg-surface-2 pl-2.5 pr-2.5 font-mono text-[11.5px] tabular-nums text-muted shadow-[var(--inset-top)] transition-colors hover:border-line-strong hover:text-ink"
            >
              {SPEEDS.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}×
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
