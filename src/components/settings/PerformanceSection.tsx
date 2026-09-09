"use client";

import { useSyncExternalStore } from "react";
import { useApp } from "@/lib/store";
import { webgpuAvailable } from "@/lib/localEngine";
import type { Device, Dtype } from "@/lib/types";
import { Field, Select } from "../ui";
import { Section } from "./Section";

const CHUNK_LENGTHS = [10, 15, 20, 30];
const STRIDE_LENGTHS = [2, 3, 5, 8];

const noopSubscribe = () => () => {};

/** WebGPU cannot be probed on the server, so report false until hydration. */
function useWebgpu(): boolean {
  return useSyncExternalStore(noopSubscribe, webgpuAvailable, () => false);
}

function SecondsSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}s
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function PerformanceSection() {
  const device = useApp((s) => s.settings.device);
  const dtype = useApp((s) => s.settings.dtype);
  const chunkLengthS = useApp((s) => s.settings.chunkLengthS);
  const strideLengthS = useApp((s) => s.settings.strideLengthS);
  const update = useApp((s) => s.updateSettings);
  const gpu = useWebgpu();

  return (
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
          value={device}
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
          value={dtype}
          onChange={(event) => update({ dtype: event.target.value as Dtype })}
        >
          <option value="q4">q4 — smaller download, faster</option>
          <option value="fp32">fp32 — full precision</option>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <SecondsSelect
          label="Chunk length"
          value={chunkLengthS}
          options={CHUNK_LENGTHS}
          onChange={(value) => update({ chunkLengthS: value })}
        />
        <SecondsSelect
          label="Overlap"
          value={strideLengthS}
          options={STRIDE_LENGTHS}
          onChange={(value) => update({ strideLengthS: value })}
        />
      </div>

      <p className="-mt-1 text-[11.5px] leading-[1.55] text-muted">
        Audio longer than 30 seconds is split into overlapping windows. More overlap costs time
        but avoids clipped words at the seams.
      </p>
    </Section>
  );
}
