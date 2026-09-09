"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: [
    "text-accent-ink border-transparent",
    "bg-[linear-gradient(180deg,var(--accent-2),var(--accent))]",
    "shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_4px_14px_-4px_var(--accent-glow)]",
    "hover:brightness-108 active:brightness-95",
  ].join(" "),
  secondary: [
    "text-ink bg-surface-2 border-line",
    "shadow-[var(--inset-top)]",
    "hover:bg-surface-3 hover:border-line-strong",
  ].join(" "),
  ghost: "bg-transparent text-muted border-transparent hover:bg-surface-2 hover:text-ink",
  danger: "bg-transparent text-danger border-transparent hover:bg-danger-soft",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[12.5px] gap-1.5 rounded-[9px]",
  md: "h-9.5 px-3.5 text-[13.5px] gap-2 rounded-[11px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...props}
      className={clsx(
        "relative inline-flex items-center justify-center border font-medium whitespace-nowrap select-none",
        "transition-[background-color,border-color,filter,transform,box-shadow] duration-150",
        "[transition-timing-function:var(--ease-out-soft)] active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      {...props}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-[9px]",
        "transition-all duration-150 [transition-timing-function:var(--ease-out-soft)]",
        "active:scale-90 disabled:pointer-events-none disabled:opacity-35",
        active
          ? "bg-accent-soft text-accent shadow-[0_0_0_1px_var(--accent-line)]"
          : "text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11.5px] leading-[1.55] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={clsx(
          "w-full appearance-none rounded-[11px] border border-line bg-surface-2",
          "h-9.5 pl-3 pr-9 text-[13px] text-ink shadow-[var(--inset-top)]",
          "transition-colors duration-150 hover:border-line-strong",
          "disabled:opacity-45",
          className,
        )}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-faint"
      >
        <path
          d="M2.6 4.6 6 8l3.4-3.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

const TONES = {
  neutral: "bg-surface-2 text-muted border-line",
  accent: "bg-accent-soft text-accent border-accent-line/60",
  ok: "bg-ok-soft text-ok border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  active: "bg-active-soft text-active border-active-line/50",
} as const;

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px]",
        "text-[11px] font-medium leading-[14px] whitespace-nowrap tracking-[-0.005em]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Pill switch used for view modes and theme. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "sm",
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="group"
      className={clsx(
        "inline-flex items-center gap-0.5 rounded-[10px] border border-line bg-surface-2 p-0.5",
        "shadow-[var(--inset-top)]",
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={clsx(
              "relative rounded-[7px] font-medium transition-all duration-150",
              "[transition-timing-function:var(--ease-out-soft)]",
              size === "sm" ? "px-2.5 py-[5px] text-[12px]" : "px-3 py-1.5 text-[13px]",
              selected
                ? "bg-raised text-ink shadow-[var(--shadow-sm)]"
                : "text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Progress({
  value,
  indeterminate,
  className,
}: {
  value: number;
  indeterminate?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={clsx(
        "relative h-1 w-full overflow-hidden rounded-full bg-surface-3",
        indeterminate && "sweep",
        className,
      )}
    >
      {indeterminate ? null : (
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-2))] transition-[width] duration-300 [transition-timing-function:var(--ease-out-soft)]"
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={clsx("size-3.5 animate-spin", className)} aria-hidden>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <path
        d="M8 1.5A6.5 6.5 0 0 1 14.5 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Small live dot for "this is happening right now". */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={clsx("relative inline-flex size-1.5 text-accent", className)}>
      <span className="pulse-ring absolute inset-0 rounded-full" />
      <span className="relative size-1.5 rounded-full bg-current" />
    </span>
  );
}
