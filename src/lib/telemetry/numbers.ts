export interface ParsedNumber {
  value: number;
  unit: string | null;
}

const NUMBER_RE = /^\s*(-?\d+(?:[.,]\d+)?(?:e[-+]?\d+)?)\s*(m\/s|km\/h|mph|kn|kt|ms|m|ft|°|deg)?\s*$/i;

/** Rejects "1/320.0", "dlog_m", "abc", "F2.8". Accepts an unambiguous decimal comma ("42,7" → 42.7). */
export function parseTelemetryNumber(raw: string): ParsedNumber | null {
  const m = NUMBER_RE.exec(raw);
  if (!m) return null;
  let num = m[1];
  if (/^-?\d+,\d+$/.test(num)) num = num.replace(",", ".");
  const value = Number(num);
  return Number.isFinite(value) ? { value, unit: m[2]?.toLowerCase() ?? null } : null;
}

/**
 * Same result as Math.min(...values) for finite input, without spreading: one argument per cue
 * overflows the call stack past ~120k values (a 35-minute 60 fps SRT).
 */
export function minOf(values: ArrayLike<number>): number {
  let min = Infinity;
  for (let i = 0; i < values.length; i++) if (values[i] < min) min = values[i];
  return min;
}

/** Same result as Math.max(...values) for finite input; see minOf. */
export function maxOf(values: ArrayLike<number>): number {
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) if (values[i] > max) max = values[i];
  return max;
}
