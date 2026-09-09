"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useApp } from "@/lib/store";
import { CLOUD_ENV_VARS, CLOUD_MODELS, noteFor } from "@/lib/models";
import type { CloudProviderId } from "@/lib/types";
import { Field, Select } from "../ui";
import { Section } from "./Section";

const KEY_PLACEHOLDERS: Record<CloudProviderId, string> = {
  openai: "sk-…",
  groq: "gsk_…",
};

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-surface-2 px-1 py-px font-mono text-[10.5px] text-ink">
      {children}
    </code>
  );
}

function ApiKeyField({ provider }: { provider: CloudProviderId }) {
  const apiKeys = useApp((s) => s.settings.apiKeys);
  const update = useApp((s) => s.updateSettings);
  const [visible, setVisible] = useState(false);

  return (
    <Field
      label="API key"
      hint={
        <>
          Stored only in this browser and sent straight to {provider}. You can instead set{" "}
          <Code>{CLOUD_ENV_VARS[provider]}</Code> in <Code>.env.local</Code>.
        </>
      }
    >
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          placeholder={KEY_PLACEHOLDERS[provider]}
          value={apiKeys[provider] ?? ""}
          onChange={(event) =>
            update({ apiKeys: { ...apiKeys, [provider]: event.target.value } })
          }
          className="h-9.5 w-full rounded-[11px] border border-line bg-surface-2 pl-3 pr-9 font-mono text-[12.5px] text-ink shadow-[var(--inset-top)] placeholder:text-faint transition-colors hover:border-line-strong"
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide key" : "Show key"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-faint transition-colors hover:text-ink"
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
    </Field>
  );
}

export function CloudModelSection({ provider }: { provider: CloudProviderId }) {
  const cloudModel = useApp((s) => s.settings.cloudModel);
  const update = useApp((s) => s.updateSettings);

  return (
    <Section title="Model">
      <Field label="Model" hint={noteFor(provider, cloudModel)}>
        <Select
          value={cloudModel}
          onChange={(event) => update({ cloudModel: event.target.value })}
        >
          {CLOUD_MODELS[provider].map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </Select>
      </Field>

      <ApiKeyField provider={provider} />
    </Section>
  );
}
