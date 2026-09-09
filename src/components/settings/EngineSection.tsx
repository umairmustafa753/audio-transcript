"use client";

import clsx from "clsx";
import { Check, Cloud, Cpu, Zap } from "lucide-react";
import { useApp } from "@/lib/store";
import { PROVIDERS } from "@/lib/models";
import type { ProviderId } from "@/lib/types";
import { Badge } from "../ui";
import { Section } from "./Section";

const ICONS = { local: Cpu, groq: Zap, openai: Cloud } as const;

function EngineOption({
  provider,
  selected,
  onSelect,
}: {
  provider: (typeof PROVIDERS)[number];
  selected: boolean;
  onSelect: (id: ProviderId) => void;
}) {
  const Icon = ICONS[provider.id];

  return (
    <button
      onClick={() => onSelect(provider.id)}
      className={clsx(
        "group relative flex items-start gap-3 rounded-[12px] border px-3.5 py-3 text-left",
        "transition-all duration-200 [transition-timing-function:var(--ease-out-soft)]",
        selected
          ? "border-accent-line bg-accent-soft"
          : "border-line bg-surface-2 hover:border-line-strong hover:bg-surface-3",
      )}
    >
      <span
        className={clsx(
          "mt-px flex size-7 shrink-0 items-center justify-center rounded-[9px] transition-colors",
          selected
            ? "bg-[linear-gradient(145deg,var(--accent-2),var(--accent))] text-accent-ink shadow-[0_3px_10px_-3px_var(--accent-glow)]"
            : "bg-surface-3 text-muted",
        )}
      >
        <Icon className="size-[15px]" strokeWidth={1.9} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
          {provider.label}
          {provider.id === "local" ? <Badge tone="ok">private</Badge> : null}
        </span>
        <span className="mt-1 block text-[11.5px] leading-[1.55] text-muted">
          {provider.blurb}
        </span>
      </span>

      {selected ? (
        <Check className="mt-1 size-3.5 shrink-0 text-accent" strokeWidth={2.5} />
      ) : null}
    </button>
  );
}

export function EngineSection() {
  const provider = useApp((s) => s.settings.provider);
  const update = useApp((s) => s.updateSettings);

  return (
    <Section title="Engine">
      <div className="flex flex-col gap-2">
        {PROVIDERS.map((option) => (
          <EngineOption
            key={option.id}
            provider={option}
            selected={provider === option.id}
            onSelect={(id) => update({ provider: id })}
          />
        ))}
      </div>
    </Section>
  );
}
