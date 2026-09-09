import { NextResponse } from "next/server";
import { CLOUD_ENV_VARS } from "@/lib/models";
import type { CloudProviderId } from "@/lib/types";

export const runtime = "nodejs";
// Long recordings can take a while on the provider side.
export const maxDuration = 300;

const ENDPOINTS: Record<CloudProviderId, string> = {
  openai: "https://api.openai.com/v1/audio",
  groq: "https://api.groq.com/openai/v1/audio",
};

/** 25 MB is the documented upload ceiling for both providers. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

interface ProviderSegment {
  start?: number;
  end?: number;
  text?: string;
}

function bad(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("Expected a multipart/form-data upload.", 400);
  }

  const file = form.get("file");
  const provider = String(form.get("provider") ?? "") as CloudProviderId;
  const model = String(form.get("model") ?? "").trim();
  const language = String(form.get("language") ?? "auto");
  const task = String(form.get("task") ?? "transcribe");

  if (!(file instanceof File)) return bad("No audio file was included in the request.", 400);
  if (provider !== "openai" && provider !== "groq") {
    return bad(`Unknown provider "${provider}".`, 400);
  }
  if (!model) return bad("No model was specified.", 400);

  if (file.size > MAX_UPLOAD_BYTES) {
    return bad(
      `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. ` +
        `${provider === "openai" ? "OpenAI" : "Groq"} accepts at most 25 MB — ` +
        "compress the file, or switch to the on-device engine, which has no size limit.",
      413,
    );
  }

  const apiKey = request.headers.get("x-provider-key")?.trim() || process.env[CLOUD_ENV_VARS[provider]];
  if (!apiKey) {
    return bad(
      `No API key for ${provider}. Set ${CLOUD_ENV_VARS[provider]} in .env.local, or paste a key in Settings.`,
      401,
    );
  }

  const isTranslation = task === "translate";
  // Only the whisper-* models expose the translation endpoint and verbose output.
  const supportsVerbose = !model.startsWith("gpt-4o");
  const endpoint = `${ENDPOINTS[provider]}/${isTranslation ? "translations" : "transcriptions"}`;

  const upstream = new FormData();
  upstream.set("file", file, file.name);
  upstream.set("model", model);
  upstream.set("response_format", supportsVerbose ? "verbose_json" : "json");
  if (supportsVerbose) upstream.set("timestamp_granularities[]", "segment");
  if (!isTranslation && language !== "auto") upstream.set("language", language);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
  } catch (error) {
    return bad(
      `Could not reach ${provider}: ${error instanceof Error ? error.message : String(error)}`,
      502,
    );
  }

  const raw = await response.text();

  if (!response.ok) {
    let detail = raw.slice(0, 500);
    try {
      const parsed = JSON.parse(raw);
      detail = parsed?.error?.message ?? detail;
    } catch {
      /* keep the raw body */
    }
    return bad(`${provider} returned ${response.status}: ${detail}`, response.status);
  }

  let payload: {
    text?: string;
    language?: string;
    duration?: number;
    segments?: ProviderSegment[];
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return bad(`${provider} returned a response that was not valid JSON.`, 502);
  }

  const segments = (payload.segments ?? [])
    .map((seg) => ({
      start: Number(seg.start ?? 0),
      end: Number(seg.end ?? 0),
      text: String(seg.text ?? "").trim(),
    }))
    .filter((seg) => seg.text.length > 0);

  return NextResponse.json({
    text: (payload.text ?? "").trim(),
    segments,
    language: isTranslation ? "en" : (payload.language ?? null),
    duration: payload.duration ?? null,
  });
}
