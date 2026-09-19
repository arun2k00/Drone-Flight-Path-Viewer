import { createInterpolator } from "./interpolator";
import { haversineMeters, initialBearingDeg } from "./geo";
import type { TelemetrySeries } from "./series";

const MAX_PLAUSIBLE_SPEED_MPS = 60;
const WINDOW_SEC = 1.0;

export interface DerivedGpsSeries {
  groundSpeedGps: (number | null)[];
  courseGps: (number | null)[];
}

/**
 * Displacement over a centred W-second window, not summed segment lengths — GPS jitter and repeated
 * values would inflate a summed path.
 */
export function deriveGpsSeries(series: TelemetrySeries, timeRange: { start: number; end: number }, W = WINDOW_SEC): DerivedGpsSeries {
  const gps = createInterpolator(series);
  const groundSpeedGps: (number | null)[] = [];
  const courseGps: (number | null)[] = [];

  for (let i = 0; i < series.length; i++) {
    const t = series.t[i];
    const t0 = Math.max(timeRange.start, t - W / 2);
    const t1 = Math.min(timeRange.end, t + W / 2);
    if (t1 - t0 < 0.5) {
      groundSpeedGps.push(null);
      courseGps.push(null);
      continue;
    }
    const p0 = gps.getAtTime(t0);
    const p1 = gps.getAtTime(t1);
    if (p0.latitude === null || p1.latitude === null) {
      groundSpeedGps.push(null);
      courseGps.push(null);
      continue;
    }
    const d = haversineMeters(p0.latitude, p0.longitude!, p1.latitude, p1.longitude!);
    const v = d / (t1 - t0);
    groundSpeedGps.push(v <= MAX_PLAUSIBLE_SPEED_MPS ? v : null);
    courseGps.push(d >= 2.0 ? initialBearingDeg(p0.latitude, p0.longitude!, p1.latitude, p1.longitude!) : null);
  }

  return { groundSpeedGps, courseGps };
}
