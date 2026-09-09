// Bar heights and delays are hand-picked so the loop reads as speech, not a metronome.
const BARS = [
  { height: 22, delay: "0ms" },
  { height: 40, delay: "130ms" },
  { height: 58, delay: "260ms" },
  { height: 34, delay: "390ms" },
  { height: 48, delay: "170ms" },
  { height: 26, delay: "300ms" },
  { height: 44, delay: "60ms" },
];

const SELLING_POINTS = [
  ["Private", "Audio never leaves this device"],
  ["Timestamped", "Click any line to jump there"],
  ["Exportable", "SRT, VTT, Markdown, JSON"],
];

/** Shown in place of the transcript panel when nothing is selected. */
export function EmptyTranscript() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <div aria-hidden className="flex h-[70px] items-center gap-[7px]">
        {BARS.map((bar, index) => (
          <span
            key={index}
            className="eq-bar w-[7px] rounded-full bg-[linear-gradient(180deg,var(--accent-2),var(--accent))] opacity-70"
            style={{ height: bar.height, animationDelay: bar.delay }}
          />
        ))}
      </div>

      <div className="max-w-md">
        <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.032em] text-ink">
          Transcribe audio without uploading it
        </h2>
        <p className="mt-3 text-[14.5px] leading-[1.65] text-muted">
          Drop a file from your computer and Whisper runs right here in the browser — no account,
          no API key, and no size limit on the recording.
        </p>
      </div>

      <dl className="grid max-w-lg grid-cols-3 gap-3 text-left">
        {SELLING_POINTS.map(([term, detail]) => (
          <div
            key={term}
            className="rounded-[13px] border border-line bg-surface-2/60 px-3.5 py-3 lit"
          >
            <dt className="text-[12px] font-semibold tracking-[-0.01em] text-ink">{term}</dt>
            <dd className="mt-1 text-[11.5px] leading-[1.5] text-muted">{detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
