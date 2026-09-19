import type { TelemetrySeries } from "./series";

/** Downsampled altitude/speed over time for the graph widgets (overlay export, viewer, share page). NaN = no value. */
export interface TelemetryProfile {
  t: Float64Array;
  relativeAltitude: Float64Array;
  absoluteAltitude: Float64Array;
  /** SRT speed where present, else GPS-derived ground speed (the "auto" speed source). m/s. */
  speed: Float64Array;
}

export const PROFILE_MAX_POINTS = 600;

export function buildProfile(series: TelemetrySeries, maxPoints = PROFILE_MAX_POINTS): TelemetryProfile {
  const stride = Math.max(1, Math.ceil(series.length / maxPoints));
  const n = Math.ceil(series.length / stride);
  const out: TelemetryProfile = { t: new Float64Array(n), relativeAltitude: new Float64Array(n), absoluteAltitude: new Float64Array(n), speed: new Float64Array(n) };
  for (let i = 0, j = 0; i < series.length; i += stride, j++) {
    out.t[j] = series.t[i];
    out.relativeAltitude[j] = series.relativeAltitude[i];
    out.absoluteAltitude[j] = series.absoluteAltitude[i];
    out.speed[j] = Number.isFinite(series.speed[i]) ? series.speed[i] : series.groundSpeedGps[i];
  }
  return out;
}

/** Finite min/max, or null when the metric was never recorded. */
export function valueRange(values: Float64Array): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min === Infinity ? null : { min, max };
}
