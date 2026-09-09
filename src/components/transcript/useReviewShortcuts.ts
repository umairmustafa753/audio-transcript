"use client";

import { isTypingTarget, useWindowKeyDown } from "@/lib/hooks";
import type { AudioPlayerApi } from "../AudioPlayer";

const NUDGE_SECONDS = 5;

/**
 * Review shortcuts: Space toggles, arrows nudge, `/` jumps to search. Time is
 * read straight off the media element so the handler never re-binds during
 * playback.
 */
export function useReviewShortcuts(
  player: AudioPlayerApi,
  searchRef: React.RefObject<HTMLInputElement | null>,
): void {
  const { audioRef, seek, toggle } = player;

  useWindowKeyDown((event) => {
    const target = event.target as HTMLElement | null;

    if (isTypingTarget(target)) {
      if (event.key === "Escape") target?.blur();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    // The waveform handles its own arrow keys while focused.
    if (target?.getAttribute("role") === "slider" && event.key.startsWith("Arrow")) return;

    const audio = audioRef.current;
    switch (event.key) {
      case " ":
        event.preventDefault();
        toggle();
        break;
      case "ArrowLeft":
        if (!audio) return;
        event.preventDefault();
        seek(audio.currentTime - NUDGE_SECONDS);
        break;
      case "ArrowRight":
        if (!audio) return;
        event.preventDefault();
        seek(audio.currentTime + NUDGE_SECONDS);
        break;
      case "/":
        event.preventDefault();
        searchRef.current?.focus();
        break;
    }
  });
}
