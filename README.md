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

It also ships as a desktop app for macOS and Windows — see [Desktop app](#desktop-app).

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
    models.ts                 model catalogue, provider list, env var names
    jobStatus.ts              isBusy / isTerminal — the only place statuses are grouped
    hooks.ts                  shared UI hooks (Escape, outside-click, theme, shortcuts)
    storageKeys.ts            the localStorage key, shared with the pre-paint theme script
  components/
    TranscriptPanel.tsx       composes the transcript view
    transcript/               header, toolbar, live progress, segment list, reading view
    SettingsPanel.tsx         the drawer shell
    settings/                 one file per settings section
    ui.tsx                    Button, Select, Field, Badge, Segmented, Progress, …
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

## Desktop app

The same app, packaged with [Electron](https://www.electronjs.org/) for macOS and
Windows. Electron bundles its own Chromium, so WebGPU, the Whisper worker and the
multi-threaded WASM backend behave the same on both systems.

```bash
npm run desktop            # build, then open the app from this checkout
npm run desktop:dist       # installer for the OS you are on → dist-desktop/
npm run desktop:dist:mac   # Scribe-<version>-arm64.dmg and Scribe-<version>.dmg (Intel)
npm run desktop:dist:win   # Scribe Setup <version>.exe (x64 + arm64)
```

For UI work, run `npm run dev` in one terminal and `npm run desktop:dev` in
another: the window then loads the dev server with hot reload.

Windows installers are most reliably built on Windows. The **Desktop app**
GitHub Actions workflow builds both platforms; start it from the Actions tab or
by pushing a `v*` tag, then download the installers from the run's artifacts.

### How it works

```
desktop/main.mjs          Electron main process
scripts/build-desktop.mjs builds Next.js as a self-contained server (.next/standalone)
electron-builder.yml      packaging: DMG for macOS, NSIS installer for Windows
```

At launch the app starts that server on a free `127.0.0.1` port in a background
process, and the window loads it through a private `app://scribe` address. The
API route keeps working, and with no Vercel in front of it there is no 4.5 MB
upload cap — only the providers' own 25 MB limit.

The fixed address matters: saved transcripts live in IndexedDB, which is keyed by
address, and the app's profile folder is pinned to `Scribe` (in
`~/Library/Application Support` on macOS, `%APPDATA%` on Windows). Changing
either one in `desktop/main.mjs` would hide every user's saved transcripts.

`.env` files are removed from the packaged server, because anything in them
would ship to everyone who installs the app. Desktop users paste API keys in
Settings instead.

### Moving existing transcripts into the desktop app

Browser storage cannot be read from another app, so transcripts move by file:

1. Open the web version where your transcripts are (for example
   `npm run dev` → http://localhost:3000, in the same browser as before).
2. **Settings → Backup → Export backup** saves a `.scribe` file with every
   transcript, its audio and your settings. API keys are left out.
3. In the desktop app, **Settings → Backup → Import backup** and pick that file.

Importing is safe to repeat; transcripts that are already there are skipped.
Nothing is removed from the browser.

### Signing

Builds are not signed with a real certificate yet, so the first launch shows a
warning:

- **macOS**: "Apple could not verify…". Open **System Settings → Privacy &
  Security** and click **Open Anyway**. To remove the warning, get an Apple
  Developer ID ($99/year), set `mac.identity` in `electron-builder.yml`, and
  configure notarization.
- **Windows**: SmartScreen says "Windows protected your PC". Click
  **More info → Run anyway**. A code-signing certificate removes it.
