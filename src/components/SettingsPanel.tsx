"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import {
  Check,
  Cloud,
  Cpu,
  Download,
  Eye,
  EyeOff,
  Laptop,
  Moon,
  Sun,
  X,
  Zap,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { CLOUD_MODELS, LOCAL_MODELS, PROVIDERS, isEnglishOnly } from "@/lib/models";
import { LANGUAGES } from "@/lib/languages";
import { formatBytes } from "@/lib/format";
import { webgpuAvailable } from "@/lib/localEngine";
import type { Device, Dtype, ProviderId, Settings, Task } from "@/lib/types";
import { Badge, Button, Field, Progress, Segmented, Select, Spinner } from "./ui";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5 border-b border-line px-5 py-5 last:border-b-0">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const warmModel = useApp((s) => s.warmModel);
  const download = useApp((s) => s.download);

  const [showKey, setShowKey] = useState(false);
  const [warming, setWarming] = useState(false);
  const [warmError, setWarmError] = useState<string | null>(null);
  const [warmed, setWarmed] = useState(false);

  // WebGPU cannot be probed on the server, so report false until hydration.
  const gpu = useSyncExternalStore(
    () => () => {},
    webgpuAvailable,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Reflect the theme choice on <html> so the CSS overrides apply immediately.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  const isLocal = settings.provider === "local";
  const cloudProvider = isLocal ? null : (settings.provider as Exclude<ProviderId, "local">);
  const englishOnly = isLocal && isEnglishOnly(settings.localModel);

  const prefetch = async () => {
    setWarming(true);
    setWarmError(null);
    setWarmed(false);
    try {
      await warmModel();
      setWarmed(true);
    } catch (error) {
      setWarmError(error instanceof Error ? error.message : String(error));
    } finally {
      setWarming(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={clsx(
          "fixed inset-0 z-40 bg-bg-deep/50 backdrop-blur-[3px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
        className={clsx(
          "glass fixed right-0 top-0 z-50 flex h-full w-full max-w-[410px] flex-col",
          "border-l border-line shadow-[var(--shadow-lg)]",
          "transition-transform duration-300 [transition-timing-function:var(--ease-out-soft)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[14px] font-semibold tracking-[-0.02em] text-ink">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-[9px] p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Section title="Engine">
            <div className="flex flex-col gap-2">
              {PROVIDERS.map((provider) => {
                const selected = settings.provider === provider.id;
                const Icon =
                  provider.id === "local" ? Cpu : provider.id === "groq" ? Zap : Cloud;
                return (
                  <button
                    key={provider.id}
                    onClick={() => update({ provider: provider.id })}
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
              })}
            </div>
          </Section>

          <Section title="Model">
            {isLocal ? (
              <>
                <Field
                  label="Whisper build"
                  hint={LOCAL_MODELS.find((m) => m.id === settings.localModel)?.note}
                >
                  <Select
                    value={settings.localModel}
                    onChange={(event) => {
                      setWarmed(false);
                      update({ localModel: event.target.value });
                    }}
                  >
                    {LOCAL_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label} — {model.size}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="flex flex-col gap-2">
                  <Button variant="secondary" size="sm" onClick={prefetch} disabled={warming}>
                    {warming ? (
                      <Spinner />
                    ) : warmed ? (
                      <Check className="size-3.5 text-ok" strokeWidth={2.4} />
                    ) : (
                      <Download className="size-3.5" strokeWidth={1.9} />
                    )}
                    {warming ? "Downloading…" : warmed ? "Ready to use" : "Download model now"}
                  </Button>

                  {warming && download ? (
                    <div className="flex flex-col gap-1.5">
                      <Progress value={download.progress} />
                      <p className="truncate font-mono text-[10.5px] tabular-nums text-faint">
                        {download.file} · {formatBytes(download.loaded)}
                        {download.total ? ` / ${formatBytes(download.total)}` : ""}
                      </p>
                    </div>
                  ) : null}

                  {warmError ? (
                    <p className="text-[11.5px] leading-[1.55] text-danger">{warmError}</p>
                  ) : (
                    <p className="text-[11.5px] leading-[1.55] text-muted">
                      Weights are cached by the browser, so this is a one-time download per model.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <Field
                  label="Model"
                  hint={CLOUD_MODELS[cloudProvider!].find((m) => m.id === settings.cloudModel)?.note}
                >
                  <Select
                    value={settings.cloudModel}
                    onChange={(event) => update({ cloudModel: event.target.value })}
                  >
                    {CLOUD_MODELS[cloudProvider!].map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="API key"
                  hint={
                    <>
                      Stored only in this browser and sent straight to {cloudProvider}. You can
                      instead set{" "}
                      <code className="rounded bg-surface-2 px-1 py-px font-mono text-[10.5px] text-ink">
                        {cloudProvider === "openai" ? "OPENAI_API_KEY" : "GROQ_API_KEY"}
                      </code>{" "}
                      in{" "}
                      <code className="rounded bg-surface-2 px-1 py-px font-mono text-[10.5px] text-ink">
                        .env.local
                      </code>
                      .
                    </>
                  }
                >
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={cloudProvider === "openai" ? "sk-…" : "gsk_…"}
                      value={settings.apiKeys[cloudProvider!] ?? ""}
                      onChange={(event) =>
                        update({
                          apiKeys: { ...settings.apiKeys, [cloudProvider!]: event.target.value },
                        })
                      }
                      className="h-9.5 w-full rounded-[11px] border border-line bg-surface-2 pl-3 pr-9 font-mono text-[12.5px] text-ink shadow-[var(--inset-top)] placeholder:text-faint transition-colors hover:border-line-strong"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((value) => !value)}
                      aria-label={showKey ? "Hide key" : "Show key"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-faint transition-colors hover:text-ink"
                    >
                      {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </Field>
              </>
            )}
          </Section>

          <Section title="Transcription">
            <Field
              label="Spoken language"
              hint={
                englishOnly
                  ? "This build is English-only, so the language is fixed."
                  : "Detection costs one extra pass. Naming the language is faster and a little more accurate."
              }
            >
              <Select
                value={englishOnly ? "en" : settings.language}
                disabled={englishOnly}
                onChange={(event) => update({ language: event.target.value })}
              >
                <option value="auto">Detect automatically</option>
                {LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Output"
              hint={
                settings.task === "translate"
                  ? "Whisper translates non-English speech into English text."
                  : "Text stays in the language that was spoken."
              }
            >
              <Select
                value={settings.task}
                disabled={englishOnly}
                onChange={(event) => update({ task: event.target.value as Task })}
              >
                <option value="transcribe">Transcribe as spoken</option>
                <option value="translate">Translate to English</option>
              </Select>
            </Field>
          </Section>

          {isLocal ? (
            <Section title="Performance">
              <Field
                label="Compute backend"
                hint={
                  gpu
                    ? "WebGPU is available here and is many times faster than WASM."
                    : "This browser has no WebGPU, so WASM will be used. Chrome or Edge is much faster."
                }
              >
                <Select
                  value={settings.device}
                  onChange={(event) => update({ device: event.target.value as Device })}
                >
                  <option value="auto">Automatic{gpu ? " (WebGPU)" : " (WASM)"}</option>
                  <option value="webgpu">WebGPU</option>
                  <option value="wasm">WASM (CPU)</option>
                </Select>
              </Field>

              <Field
                label="Weight precision"
                hint="q4 quantises the decoder only; the encoder stays at full precision either way. Move up to fp32 if a model produces garbled text."
              >
                <Select
                  value={settings.dtype}
                  onChange={(event) => update({ dtype: event.target.value as Dtype })}
                >
                  <option value="q4">q4 — smaller download, faster</option>
                  <option value="fp32">fp32 — full precision</option>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Chunk length">
                  <Select
                    value={settings.chunkLengthS}
                    onChange={(event) => update({ chunkLengthS: Number(event.target.value) })}
                  >
                    {[10, 15, 20, 30].map((value) => (
                      <option key={value} value={value}>
                        {value}s
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Overlap">
                  <Select
                    value={settings.strideLengthS}
                    onChange={(event) => update({ strideLengthS: Number(event.target.value) })}
                  >
                    {[2, 3, 5, 8].map((value) => (
                      <option key={value} value={value}>
                        {value}s
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <p className="-mt-1 text-[11.5px] leading-[1.55] text-muted">
                Audio longer than 30 seconds is split into overlapping windows. More overlap costs
                time but avoids clipped words at the seams.
              </p>
            </Section>
          ) : null}

          <Section title="Appearance">
            <Segmented<Settings["theme"]>
              size="md"
              value={settings.theme}
              onChange={(theme) => update({ theme })}
              options={[
                {
                  value: "system",
                  label: (
                    <span className="flex items-center gap-1.5">
                      <Laptop className="size-3.5" strokeWidth={1.9} />
                      System
                    </span>
                  ),
                },
                {
                  value: "light",
                  label: (
                    <span className="flex items-center gap-1.5">
                      <Sun className="size-3.5" strokeWidth={1.9} />
                      Light
                    </span>
                  ),
                },
                {
                  value: "dark",
                  label: (
                    <span className="flex items-center gap-1.5">
                      <Moon className="size-3.5" strokeWidth={1.9} />
                      Dark
                    </span>
                  ),
                },
              ]}
            />
          </Section>
        </div>
      </aside>
    </>
  );
}
