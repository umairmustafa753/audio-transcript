import type { ModelOption, ProviderId } from "./types";

/**
 * Whisper builds that ship ONNX weights, so they can run entirely in the browser
 * through transformers.js. Weights are fetched from the Hugging Face CDN on first
 * use and then cached by the browser's Cache Storage — later runs are offline.
 */
export const LOCAL_MODELS: ModelOption[] = [
  {
    id: "onnx-community/whisper-tiny",
    label: "Whisper tiny",
    size: "~45 MB",
    note: "Fastest. Good for quick drafts and clean audio.",
    multilingual: true,
  },
  {
    id: "onnx-community/whisper-base",
    label: "Whisper base",
    size: "~85 MB",
    note: "Balanced default. Noticeably better than tiny.",
    multilingual: true,
  },
  {
    id: "onnx-community/whisper-small",
    label: "Whisper small",
    size: "~250 MB",
    note: "Strong accuracy. Slow without WebGPU.",
    multilingual: true,
  },
  {
    id: "onnx-community/whisper-large-v3-turbo",
    label: "Whisper large-v3-turbo",
    size: "~800 MB",
    note: "Best accuracy. Needs WebGPU and plenty of memory.",
    multilingual: true,
  },
  {
    id: "onnx-community/whisper-tiny.en",
    label: "Whisper tiny (English-only)",
    size: "~45 MB",
    note: "English-only variant, slightly sharper than multilingual tiny.",
    multilingual: false,
  },
  {
    id: "onnx-community/whisper-base.en",
    label: "Whisper base (English-only)",
    size: "~85 MB",
    note: "English-only variant of base.",
    multilingual: false,
  },
];

export const CLOUD_MODELS: Record<Exclude<ProviderId, "local">, ModelOption[]> = {
  openai: [
    {
      id: "whisper-1",
      label: "whisper-1",
      size: "API",
      note: "Returns segment timestamps. 25 MB upload limit.",
      multilingual: true,
    },
    {
      id: "gpt-4o-transcribe",
      label: "gpt-4o-transcribe",
      size: "API",
      note: "Highest accuracy. Text only — no segment timestamps.",
      multilingual: true,
    },
    {
      id: "gpt-4o-mini-transcribe",
      label: "gpt-4o-mini-transcribe",
      size: "API",
      note: "Cheaper 4o variant. Text only — no segment timestamps.",
      multilingual: true,
    },
  ],
  groq: [
    {
      id: "whisper-large-v3-turbo",
      label: "whisper-large-v3-turbo",
      size: "API",
      note: "Very fast, with segment timestamps. 25 MB upload limit.",
      multilingual: true,
    },
    {
      id: "whisper-large-v3",
      label: "whisper-large-v3",
      size: "API",
      note: "Most accurate Groq option, with segment timestamps.",
      multilingual: true,
    },
  ],
};

export const PROVIDERS: {
  id: ProviderId;
  label: string;
  blurb: string;
  needsKey: boolean;
}[] = [
  {
    id: "local",
    label: "On this device",
    blurb: "Whisper runs in your browser. Audio never leaves the machine.",
    needsKey: false,
  },
  {
    id: "openai",
    label: "OpenAI",
    blurb: "Uploads the file to OpenAI's transcription endpoint.",
    needsKey: true,
  },
  {
    id: "groq",
    label: "Groq",
    blurb: "Uploads the file to Groq's Whisper endpoint. Usually the fastest.",
    needsKey: true,
  },
];

export function modelsFor(provider: ProviderId): ModelOption[] {
  return provider === "local" ? LOCAL_MODELS : CLOUD_MODELS[provider];
}

export function defaultModelFor(provider: ProviderId): string {
  return modelsFor(provider)[provider === "local" ? 1 : 0].id;
}

export function isEnglishOnly(modelId: string): boolean {
  return modelId.endsWith(".en");
}
