export const NUM = String.raw`-?\d+(?:\.\d+)?`;

export function stripTags(payload: string): string {
  return payload.replace(/<[^>]+>/g, " ");
}

const DATE_RE = /(\d{4})[-./](\d{2})[-./](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:[.,:](\d{1,3}))?(?:[.,:]\d{1,3})?/;

export interface ExtractedDate {
  text: string; // "YYYY-MM-DD HH:MM:SS.mmm"
  ms: number; // Date.UTC(...) of the naive wall clock
}

/** The date line is the aircraft's local wall clock, no timezone. Also accepts "2017.08.05 14:11:51". */
export function extractDate(text: string): ExtractedDate | null {
  const m = DATE_RE.exec(text);
  if (!m) return null;
  const ms = (m[7] ?? "0").padEnd(3, "0");
  return {
    text: `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}.${ms}`,
    ms: Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]), Number(ms)),
  };
}
