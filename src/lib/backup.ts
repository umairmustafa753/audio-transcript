import type { Job, Settings } from "./types";
import type { StoredRecord } from "./db";

/**
 * A backup is a single file: a 16-byte header, a JSON manifest, then every audio
 * file and waveform laid end to end as raw bytes. Blobs stay lazy on both ends,
 * so exporting or importing hours of audio never holds it all in memory.
 *
 *   "SCRIBEBK" | u32 version | u32 manifest length | manifest | data…
 */
const MAGIC = "SCRIBEBK";
const VERSION = 1;
const HEADER_BYTES = 16;

export const BACKUP_EXTENSION = ".scribe";

interface BlobRef {
  /** byte offset from the start of the data section */
  offset: number;
  size: number;
}

interface AudioRef extends BlobRef {
  name: string;
  type: string;
  lastModified: number;
}

interface Manifest {
  exportedAt: number;
  settings: Partial<Settings>;
  items: { job: Job; audio: AudioRef | null; peaks: BlobRef | null }[];
}

export interface Backup {
  records: StoredRecord[];
  settings: Partial<Settings>;
}

export function buildBackup(records: StoredRecord[], settings: Settings): Blob {
  const parts: Blob[] = [];
  let offset = 0;
  const append = (blob: Blob): BlobRef => {
    const ref = { offset, size: blob.size };
    parts.push(blob);
    offset += blob.size;
    return ref;
  };

  const items = records.map(({ job, file, peaks }) => ({
    job,
    audio: file
      ? { ...append(file), name: file.name, type: file.type, lastModified: file.lastModified }
      : null,
    peaks: peaks ? append(new Blob([peaks.slice()])) : null,
  }));

  // Keys are credentials: a backup is a file people copy around and share.
  const manifest: Manifest = {
    exportedAt: Date.now(),
    settings: { ...settings, apiKeys: {} },
    items,
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));

  const header = new Uint8Array(HEADER_BYTES);
  header.set(new TextEncoder().encode(MAGIC));
  const view = new DataView(header.buffer);
  view.setUint32(8, VERSION, true);
  view.setUint32(12, manifestBytes.byteLength, true);

  return new Blob([header, manifestBytes, ...parts], { type: "application/octet-stream" });
}

export async function readBackup(file: Blob): Promise<Backup> {
  const notBackup = new Error(
    `That file is not a Scribe backup. Choose a ${BACKUP_EXTENSION} file made with "Export backup".`,
  );
  if (file.size < HEADER_BYTES) throw notBackup;

  const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  if (new TextDecoder().decode(header.subarray(0, MAGIC.length)) !== MAGIC) throw notBackup;

  const view = new DataView(header.buffer);
  const version = view.getUint32(8, true);
  if (version > VERSION) {
    throw new Error("This backup was made by a newer version of Scribe. Update the app to open it.");
  }
  const manifestEnd = HEADER_BYTES + view.getUint32(12, true);
  if (manifestEnd > file.size) throw new Error("This backup is incomplete — it may have been cut off while copying.");

  let manifest: Manifest;
  try {
    manifest = JSON.parse(await file.slice(HEADER_BYTES, manifestEnd).text());
  } catch {
    throw new Error("This backup is damaged and cannot be read.");
  }

  const slice = (ref: BlobRef) => {
    const start = manifestEnd + ref.offset;
    if (start + ref.size > file.size) {
      throw new Error("This backup is incomplete — it may have been cut off while copying.");
    }
    return file.slice(start, start + ref.size);
  };

  const records = await Promise.all(
    (manifest.items ?? []).map(async ({ job, audio, peaks }) => ({
      job,
      file: audio
        ? new File([slice(audio)], audio.name, {
            type: audio.type,
            lastModified: audio.lastModified,
          })
        : null,
      peaks: peaks ? new Float32Array(await slice(peaks).arrayBuffer()) : null,
    })),
  );

  return { records, settings: manifest.settings ?? {} };
}
