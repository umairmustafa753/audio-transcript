# Scribe — local audio transcription

A Next.js app that turns audio files on your computer into text. By default the
whole thing runs **in the browser**: OpenAI's Whisper model is compiled to
WebAssembly/WebGPU via [transformers.js](https://github.com/huggingface/transformers.js),
so the audio is never uploaded anywhere. OpenAI and Groq are available as opt-in
engines if you would rather trade privacy for speed.

```bash
npm install
npm run dev      # http://localhost:3000
```

No API key, no `.env`, no ffmpeg. Drop a file in and it transcribes.

---

## What it does

- **Drag and drop, or pick files** — MP3, WAV, M4A, AAC, FLAC, OGG/Opus, WebM,
  and the audio track of MP4/MOV. Several files at a time; they run as a queue.
- **Live transcription** — text streams in as the model decodes, with a progress
  bar and a tokens/second readout.
- **Timestamped segments** — click any line to jump the audio there. The current
  line highlights and auto-scrolls as it plays.
- **Waveform player** — scrub, ±10s, 0.75×–2× speed, mute.
- **Two reading modes** — timestamped lines, or re-flowed paragraphs that break
  on natural pauses.
- **Search** inside a transcript, with match highlighting.
- **Export** to TXT, SRT, VTT, Markdown, CSV or JSON, or copy to the clipboard.
- **Translate** non-English speech to English text instead of transcribing it.
- **Everything is saved** in the browser (IndexedDB), audio included, so
  transcripts survive a reload.
- **Keyboard shortcuts** — `Space` play/pause, `←`/`→` nudge 5s, `/` jump to
  search, `Esc` leave the field, `⌘,` open settings.
- **Light and dark themes**, following the system by default.

## Engines

Pick one in **Settings → Engine**.

| Engine | Where audio goes | Needs a key | Notes |
| --- | --- | --- | --- |
| **On this device** (default) | Nowhere — it stays in the tab | No | Whisper tiny → large-v3-turbo. First use downloads the weights once, then they are cached. |
| **OpenAI** | api.openai.com | Yes | `whisper-1` (timestamps) or `gpt-4o-transcribe` (text only). 25 MB limit. |
| **Groq** | api.groq.com | Yes | `whisper-large-v3-turbo`. Very fast, with timestamps. 25 MB limit. |

For the cloud engines, either paste a key in Settings (kept in `localStorage`,
sent straight through to the provider) or put it in `.env.local`:

```bash
cp .env.example .env.local
```

```
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
```

Keys in `.env.local` stay on the server; the browser never sees them.

## On-device performance

The in-browser engine is dramatically faster with **WebGPU** (Chrome, Edge, and
Safari 26+). Without it, it falls back to multi-threaded WebAssembly, which
works but can run slower than real time on the larger models.

Rough guidance for one hour of audio:

| Model | Download | WebGPU | WASM |
| --- | --- | --- | --- |
| `whisper-tiny` | ~45 MB | a minute or two | several minutes |
| `whisper-base` (default) | ~85 MB | a few minutes | slow |
| `whisper-small` | ~250 MB | moderate | impractical |
| `whisper-large-v3-turbo` | ~800 MB | moderate | not recommended |

Two settings matter most:

- **Compute backend** — leave on *Automatic* unless you are debugging.
- **Weight precision** — `q4` (default) quantises the decoder to 4 bits and
  leaves the encoder at full precision. `fp32` is the alternative; it is roughly
  40% slower and downloads several times more. Only these two are offered
  because onnxruntime-web cannot build a session for the `q8` or `fp16` Whisper
  graphs that onnx-community publishes.

If you know the language, set it explicitly rather than leaving detection on —
it is both faster and more accurate.

The app sends `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`
headers (see [next.config.ts](next.config.ts)) so the page is cross-origin
isolated, which is what lets the WASM backend use several threads.

## How it fits together

```
src/
  app/
    page.tsx                  app shell: queue on the left, transcript on the right
    api/transcribe/route.ts   proxy for the OpenAI / Groq engines
  workers/
    whisper.worker.ts         Whisper inference, off the main thread
  lib/
    audio.ts                  file → 16 kHz mono PCM via Web Audio, plus waveform peaks
    localEngine.ts            typed client for the worker, one job at a time
    cloudEngine.ts            client for the API route
    store.ts                  zustand store and the job queue
    db.ts                     IndexedDB persistence for jobs, audio and settings
    segments.ts               timestamp clean-up and lookup
    format.ts                 TXT / SRT / VTT / MD / CSV / JSON exporters
```

Audio is decoded on the main thread with the Web Audio API — which is why no
ffmpeg is needed, and why the supported formats are whatever the browser can
already play. The resulting PCM buffer is *transferred* (not copied) into the
worker, so a two-hour recording does not double in memory.

Whisper only sees 30 seconds at a time, so longer audio is split into
overlapping windows and the transcripts are stitched back together. The overlap
is configurable in Settings.

## Notes and limits

- Whisper does not identify speakers. There is no diarization here.
- Very long files are limited by browser memory: decoded 16 kHz mono audio costs
  roughly 230 MB per hour. Several hours at once may exhaust a tab.
- Audio larger than 120 MB is not copied into IndexedDB, so after a reload the
  transcript is still there but the player is not.
- `npm audit` reports advisories in `onnxruntime-node` and `sharp`. Both are
  Node-only optional dependencies of transformers.js; this app only ever loads
  the browser build, so neither is bundled or executed.

## Scripts

```bash
npm run dev     # dev server
npm run build   # production build
npm start       # serve the production build
npm run lint    # eslint
```
