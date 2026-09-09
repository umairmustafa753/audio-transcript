"use client";

import { useApp } from "@/lib/store";
import { isEnglishOnly } from "@/lib/models";
import { LANGUAGES } from "@/lib/languages";
import type { Task } from "@/lib/types";
import { Field, Select } from "../ui";
import { Section } from "./Section";

export function TranscriptionSection() {
  const provider = useApp((s) => s.settings.provider);
  const localModel = useApp((s) => s.settings.localModel);
  const language = useApp((s) => s.settings.language);
  const task = useApp((s) => s.settings.task);
  const update = useApp((s) => s.updateSettings);

  // The `.en` builds have no language or task choice — Whisper fixes both.
  const englishOnly = provider === "local" && isEnglishOnly(localModel);

  return (
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
          value={englishOnly ? "en" : language}
          disabled={englishOnly}
          onChange={(event) => update({ language: event.target.value })}
        >
          <option value="auto">Detect automatically</option>
          {LANGUAGES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Output"
        hint={
          task === "translate"
            ? "Whisper translates non-English speech into English text."
            : "Text stays in the language that was spoken."
        }
      >
        <Select
          value={task}
          disabled={englishOnly}
          onChange={(event) => update({ task: event.target.value as Task })}
        >
          <option value="transcribe">Transcribe as spoken</option>
          <option value="translate">Translate to English</option>
        </Select>
      </Field>
    </Section>
  );
}
