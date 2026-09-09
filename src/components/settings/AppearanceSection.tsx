"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useApp } from "@/lib/store";
import type { Settings } from "@/lib/types";
import { Segmented } from "../ui";
import { Section } from "./Section";

type Theme = Settings["theme"];

const THEMES: { value: Theme; icon: typeof Laptop; label: string }[] = [
  { value: "system", icon: Laptop, label: "System" },
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
];

const OPTIONS = THEMES.map(({ value, icon: Icon, label }) => ({
  value,
  label: (
    <span className="flex items-center gap-1.5">
      <Icon className="size-3.5" strokeWidth={1.9} />
      {label}
    </span>
  ),
}));

export function AppearanceSection() {
  const theme = useApp((s) => s.settings.theme);
  const update = useApp((s) => s.updateSettings);

  return (
    <Section title="Appearance">
      <Segmented<Theme>
        size="md"
        value={theme}
        onChange={(next) => update({ theme: next })}
        options={OPTIONS}
      />
    </Section>
  );
}
