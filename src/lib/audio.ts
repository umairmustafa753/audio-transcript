/** Whisper always expects 16 kHz mono PCM. */
export const TARGET_SAMPLE_RATE = 16000;

export interface DecodedAudio {
  /** mono, 16 kHz, range roughly [-1, 1] */
  pcm: Float32Array;
  durationSec: number;
  /** normalised min/max envelope for waveform drawing */
  peaks: Float32Array;
}

export const ACCEPTED_EXTENSIONS = [
  ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".flac",
  ".webm", ".mp4", ".m4b", ".mov", ".aiff", ".aif", ".wma", ".3gp",
];

export function isProbablyAudio(file: File): boolean {
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) return true;
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (sharedContext && sharedContext.state !== "closed") return sharedContext;
  const Ctor: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    throw new Error("This browser does not expose the Web Audio API, so audio cannot be decoded.");
  }
  try {
    sharedContext = new Ctor({ sampleRate: TARGET_SAMPLE_RATE });
  } catch {
    // Some browsers reject non-native sample rates; fall back and resample below.
    sharedContext = new Ctor();
  }
  return sharedContext;
}

/** Average every channel into one, which is what Whisper's feature extractor wants. */
function downmix(buffer: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = buffer;
  if (numberOfChannels === 1) return buffer.getChannelData(0).slice();

  const mono = new Float32Array(length);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i];
  }
  const scale = 1 / numberOfChannels;
  for (let i = 0; i < length; i++) mono[i] *= scale;
  return mono;
}

async function resample(buffer: AudioBuffer): Promise<AudioBuffer> {
  const frames = Math.max(
    1,
    Math.ceil((buffer.duration * TARGET_SAMPLE_RATE)),
  );
  const OfflineCtor: typeof OfflineAudioContext =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const offline = new OfflineCtor(1, frames, TARGET_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  return offline.startRendering();
}

/**
 * Build a fixed-width amplitude envelope so the waveform canvas does not have to
 * walk millions of samples on every repaint.
 */
function computePeaks(pcm: Float32Array, buckets = 1400): Float32Array {
  const peaks = new Float32Array(buckets);
  if (pcm.length === 0) return peaks;
  const step = pcm.length / buckets;
  let max = 1e-6;
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * step);
    const end = Math.min(pcm.length, Math.floor((b + 1) * step));
    let peak = 0;
    for (let i = start; i < end; i++) {
      const v = pcm[i] < 0 ? -pcm[i] : pcm[i];
      if (v > peak) peak = v;
    }
    peaks[b] = peak;
    if (peak > max) max = peak;
  }
  // Normalise so quiet recordings still render a readable waveform.
  for (let b = 0; b < buckets; b++) peaks[b] /= max;
  return peaks;
}

export async function decodeAudioFile(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<DecodedAudio> {
  onProgress?.(0.05);
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.(0.35);

  const ctx = getContext();
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(arrayBuffer);
  } catch {
    throw new Error(
      `"${file.name}" could not be decoded. The browser does not recognise this container or codec — ` +
        "try converting it to WAV, MP3 or M4A first.",
    );
  }
  onProgress?.(0.75);

  if (buffer.sampleRate !== TARGET_SAMPLE_RATE) {
    buffer = await resample(buffer);
  }

  const pcm = downmix(buffer);
  onProgress?.(0.92);
  const peaks = computePeaks(pcm);
  onProgress?.(1);

  return { pcm, durationSec: buffer.duration, peaks };
}
