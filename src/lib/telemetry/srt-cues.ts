export interface DecodedSrt {
  text: string;
  encoding: "utf-8" | "utf-16le" | "utf-16be";
  replacementRatio: number;
}

const TS = String.raw`(\d{1,3}):([0-5]?\d):([0-5]?\d)(?:[,.:](\d{1,6}))?`;
export const SRT_TIMING_RE = new RegExp(String.raw`^\s*${TS}\s*-->\s*${TS}`);
const SINGLE_TS_RE = new RegExp(String.raw`^\s*${TS}\s*$`);

function toSec(h: string, m: string, s: string, f: string | undefined): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + (f ? Number(`0.${f}`) : 0);
}

/** "00:01:10,500" → 70.5. Required results: the timestamp test vectors. */
export function parseSrtTimestamp(value: string): number | null {
  const m = SINGLE_TS_RE.exec(value);
  return m ? toSec(m[1], m[2], m[3], m[4]) : null;
}

export function formatSrtTimestamp(totalSeconds: number): string {
  const totalMs = Math.round(Math.max(0, totalSeconds) * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

/** BOM-aware decode (UTF-8/UTF-16LE/UTF-16BE, default UTF-8) with newline normalization. */
export function decodeSrtBytes(bytes: Uint8Array): DecodedSrt {
  let encoding: DecodedSrt["encoding"] = "utf-8";
  let offset = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    offset = 3;
  } else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "utf-16le";
    offset = 2;
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = "utf-16be";
    offset = 2;
  }

  const decoder = new TextDecoder(encoding, { fatal: false });
  const text = decoder.decode(bytes.subarray(offset)).replace(/\r\n?/g, "\n");
  const replacementCount = (text.match(/�/g) ?? []).length;
  const replacementRatio = replacementCount / Math.max(1, text.length);

  return { text, encoding, replacementRatio };
}

/** True when at least one line matches the SRT cue timing format ("00:00:01,000 --> 00:00:02,000"). */
export function hasSrtTimingLine(text: string): boolean {
  return text.split("\n").some((line) => SRT_TIMING_RE.test(line));
}

export interface SrtCue {
  ordinal: number; // 0-based order of timing lines in the file
  index: number | null; // the integer line before the timing line, if any
  line: number; // 1-based line number of the timing line
  timing: { startTime: number; endTime: number } | { error: "BAD_TIMESTAMP" | "END_BEFORE_START" };
  payload: string; // lines joined with "\n", leading/trailing blank lines removed
}

function trimTrailingBlank(lines: string[]): void {
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
}

interface DraftCue {
  ordinal: number;
  index: number | null;
  line: number;
  timing: SrtCue["timing"];
  lines: string[];
}

function finalize(cue: DraftCue): SrtCue {
  const lines = [...cue.lines];
  while (lines.length && lines[0].trim() === "") lines.shift();
  trimTrailingBlank(lines);
  return { ordinal: cue.ordinal, index: cue.index, line: cue.line, timing: cue.timing, payload: lines.join("\n") };
}

/** Any line containing "-->" starts a new cue, even when its timing can't be parsed. */
export function tokenizeSrt(text: string): SrtCue[] {
  const lines = text.split("\n");
  const cues: SrtCue[] = [];
  const preamble: string[] = [];
  let current: DraftCue | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("-->")) {
      let index: number | null = null;
      if (current) {
        trimTrailingBlank(current.lines);
        const last = current.lines[current.lines.length - 1];
        if (last !== undefined && /^\s*\d+\s*$/.test(last)) {
          index = Number.parseInt(last, 10);
          current.lines.pop();
          trimTrailingBlank(current.lines);
        }
        cues.push(finalize(current));
      } else {
        const lastPre = [...preamble].reverse().find((l) => l.trim() !== "");
        if (lastPre !== undefined && /^\s*\d+\s*$/.test(lastPre)) index = Number.parseInt(lastPre, 10);
      }

      const m = SRT_TIMING_RE.exec(line);
      let timing: SrtCue["timing"];
      if (!m) {
        timing = { error: "BAD_TIMESTAMP" };
      } else {
        const startTime = toSec(m[1], m[2], m[3], m[4]);
        const endTime = toSec(m[5], m[6], m[7], m[8]);
        timing = endTime < startTime ? { error: "END_BEFORE_START" } : { startTime, endTime };
      }
      current = { ordinal: cues.length, index, line: i + 1, timing, lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }

  if (current) {
    trimTrailingBlank(current.lines);
    cues.push(finalize(current));
  }
  return cues;
}
