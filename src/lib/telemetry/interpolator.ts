import { normalize180, normalize360 } from "./normalizer";
import type { TelemetrySeries } from "./series";

export const MAX_INTERPOLATION_GAP_SEC = 2.0;

export interface InterpolatedTelemetry {
  srtTime: number;
  inRange: boolean; // timeRange.start ≤ srtTime ≤ timeRange.end
  latitude: number | null;
  longitude: number | null;
  relativeAltitude: number | null;
  absoluteAltitude: number | null;
  speed: number | null; // SRT speed
  speedX: number | null;
  speedY: number | null;
  speedZ: number | null;
  groundSpeedGps: number | null; // derived
  heading: number | null; // SRT heading
  courseGps: number | null; // derived
  aircraftPitch: number | null;
  aircraftRoll: number | null;
  aircraftYaw: number | null;
  gimbalPitch: number | null;
  gimbalRoll: number | null;
  gimbalYaw: number | null;
  recordedAtMs: number | null;
  sampleIndex: number; // last sample with t ≤ srtTime (clamped to [0, length−1])
}

export interface TelemetryInterpolator {
  readonly range: { start: number; end: number };
  getAtTime(srtTime: number): InterpolatedTelemetry;
}

const LINEAR = [
  "relativeAltitude",
  "absoluteAltitude",
  "speed",
  "speedX",
  "speedY",
  "speedZ",
  "groundSpeedGps",
  "aircraftPitch",
  "aircraftRoll",
  "gimbalPitch",
  "gimbalRoll",
  "recordedAtMs",
] as const;
const CIRC360 = ["heading", "courseGps"] as const;
const CIRC180 = ["aircraftYaw", "gimbalYaw"] as const;
type SeriesField = keyof TelemetrySeries & string;

interface Bracket {
  a: number;
  b: number;
  f: number;
}

/** Binary search is O(log n) per field, cheap enough for every frame and preview repaint. */
export function createInterpolator(series: TelemetrySeries, opts: { maxGapSec?: number } = {}): TelemetryInterpolator {
  const maxGapSec = opts.maxGapSec ?? MAX_INTERPOLATION_GAP_SEC;
  const fields: SeriesField[] = ["latitude", ...LINEAR, ...CIRC360, ...CIRC180];
  const T = series.t;

  const valid: Record<string, Int32Array> = {};
  for (const f of fields) {
    const ids: number[] = [];
    const col = series[f] as Float64Array;
    for (let i = 0; i < series.length; i++) if (!Number.isNaN(col[i])) ids.push(i);
    valid[f] = Int32Array.from(ids);
  }

  const range = series.length
    ? { start: Math.min(...Array.from(series.start)), end: Math.max(...Array.from(series.end)) }
    : { start: 0, end: 0 };
  const allIndices = Int32Array.from({ length: series.length }, (_, i) => i);

  function bracket(ids: Int32Array, t: number): number {
    let lo = 0;
    let hi = ids.length - 1;
    let k = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (T[ids[mid]] <= t) {
        k = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return k;
  }

  function lookup(field: SeriesField, t: number): Bracket | null {
    const ids = valid[field];
    if (ids.length === 0) return null;
    const k = bracket(ids, t);
    if (k >= 0 && T[ids[k]] === t) return { a: ids[k], b: ids[k], f: 0 };
    const a = k >= 0 ? ids[k] : -1;
    const b = k + 1 < ids.length ? ids[k + 1] : -1;
    if (a >= 0 && b >= 0) {
      if (T[b] - T[a] <= maxGapSec) return { a, b, f: (t - T[a]) / (T[b] - T[a]) };
      if (t <= series.end[a]) return { a, b: a, f: 0 }; // hold within a's own cue
      if (t >= series.start[b]) return { a: b, b, f: 0 }; // hold within b's own cue
      return null; // inside a gap: don't interpolate without data
    }
    if (a >= 0) return t <= series.end[a] ? { a, b: a, f: 0 } : null;
    if (b >= 0) return t >= series.start[b] ? { a: b, b, f: 0 } : null;
    return null;
  }

  const lin = (va: number, vb: number, f: number) => va + (vb - va) * f;
  const circ = (va: number, vb: number, f: number, norm: (v: number) => number) => norm(va + (((vb - va + 540) % 360) - 180) * f);

  function sampleIndexAt(t: number): number {
    if (series.length === 0) return 0;
    const k = bracket(allIndices, t);
    return Math.min(Math.max(k, 0), series.length - 1);
  }

  function getAtTime(srtTime: number): InterpolatedTelemetry {
    const out: Record<string, unknown> = { srtTime, sampleIndex: sampleIndexAt(srtTime) };
    const inRange = srtTime >= range.start && srtTime <= range.end;
    out.inRange = inRange;
    if (!inRange) {
      for (const f of ["longitude", ...fields]) out[f] = null;
      return out as unknown as InterpolatedTelemetry;
    }

    const g = lookup("latitude", srtTime);
    if (g) {
      out.latitude = lin(series.latitude[g.a], series.latitude[g.b], g.f);
      let lonB = series.longitude[g.b];
      const lonA = series.longitude[g.a];
      if (Math.abs(lonB - lonA) > 180) lonB += lonB < lonA ? 360 : -360;
      out.longitude = normalize180(lin(lonA, lonB, g.f));
    } else {
      out.latitude = null;
      out.longitude = null;
    }
    for (const f of LINEAR) {
      const r = lookup(f, srtTime);
      out[f] = r ? lin(series[f][r.a], series[f][r.b], r.f) : null;
    }
    for (const f of CIRC360) {
      const r = lookup(f, srtTime);
      out[f] = r ? circ(series[f][r.a], series[f][r.b], r.f, normalize360) : null;
    }
    for (const f of CIRC180) {
      const r = lookup(f, srtTime);
      out[f] = r ? circ(series[f][r.a], series[f][r.b], r.f, normalize180) : null;
    }
    return out as unknown as InterpolatedTelemetry;
  }

  return { range, getAtTime };
}
