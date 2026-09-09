"use client";

import { useEffect, useRef } from "react";
import type { Settings } from "./types";

/** True when a keystroke belongs to a text field rather than to a shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || Boolean(el?.isContentEditable)
  );
}

/**
 * Close-on-Escape for panels and menus. The callback is read through a ref so a
 * fresh inline arrow at the call site does not re-bind the listener every render.
 */
export function useOnEscape(active: boolean, onEscape: () => void): void {
  const latest = useRef(onEscape);
  useEffect(() => {
    latest.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") latest.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active]);
}

/** Dismiss when a pointer goes down outside `ref`. */
export function useOutsideClick(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
): void {
  const latest = useRef(onOutside);
  useEffect(() => {
    latest.current = onOutside;
  });

  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) latest.current();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [ref, active]);
}

/** Mirror the theme choice onto <html> so the CSS overrides apply immediately. */
export function useThemeAttribute(theme: Settings["theme"]): void {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);
}

/**
 * Window-level keyboard shortcuts. Handlers usually close over changing state,
 * so the listener is bound once and dispatches through a ref.
 */
export function useWindowKeyDown(onKeyDown: (event: KeyboardEvent) => void): void {
  const latest = useRef(onKeyDown);
  useEffect(() => {
    latest.current = onKeyDown;
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => latest.current(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
