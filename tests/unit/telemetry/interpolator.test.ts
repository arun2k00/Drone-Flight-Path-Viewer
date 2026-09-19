import { describe, expect, it } from "vitest";
import { createInterpolator } from "@/lib/telemetry/interpolator";
import type { TelemetrySeries } from "@/lib/telemetry/series";

const ALL_FIELDS: (keyof TelemetrySeries)[] = [
  "latitude",
  "longitude",
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
  "heading",
  "courseGps",
  "aircraftYaw",
  "gimbalYaw",
];

/** Builds a minimal series with every field NaN except the one field under test. */
function mkSeries(times: number[], overrides: Partial<Record<keyof TelemetrySeries, number[]>> = {}): TelemetrySeries {
  const s = {
    length: times.length,
    t: Float64Array.from(times),
    start: Float64Array.from(times.map((x) => x - 0.5)),
    end: Float64Array.from(times.map((x) => x + 0.5)),
  } as TelemetrySeries;
  for (const f of ALL_FIELDS) (s as unknown as Record<string, Float64Array>)[f] = new Float64Array(times.length).fill(NaN);
  for (const [field, values] of Object.entries(overrides)) {
    (s as unknown as Record<string, Float64Array>)[field] = Float64Array.from(values as number[]);
  }
  return s;
}

describe("createInterpolator — linear fields", () => {
  it("10s=100, 20s=200 → 15s=150", () => {
    const series = mkSeries([10, 20], { relativeAltitude: [100, 200] });
    expect(createInterpolator(series, { maxGapSec: 20 }).getAtTime(15).relativeAltitude).toBeCloseTo(150, 9);
  });

  it("an exact sample hit returns the sample value directly", () => {
    const series = mkSeries([10, 20], { relativeAltitude: [100, 200] });
    expect(createInterpolator(series, { maxGapSec: 20 }).getAtTime(10).relativeAltitude).toBe(100);
    expect(createInterpolator(series, { maxGapSec: 20 }).getAtTime(20).relativeAltitude).toBe(200);
  });

  it("out of range returns null for every field and inRange=false", () => {
    const series = mkSeries([10, 20], { relativeAltitude: [100, 200] });
    const it1 = createInterpolator(series, { maxGapSec: 20 });
    const before = it1.getAtTime(5);
    const after = it1.getAtTime(25);
    expect(before.inRange).toBe(false);
    expect(before.relativeAltitude).toBeNull();
    expect(before.latitude).toBeNull();
    expect(after.inRange).toBe(false);
    expect(after.relativeAltitude).toBeNull();
  });

  it("a gap wider than maxGapSec holds each side's value within its own cue bounds, and is null inside the gap", () => {
    // Samples 5 s apart, cue half-width 0.5 s (start/end = t ± 0.5), maxGapSec default 2.0 s.
    const series = mkSeries([0, 5], { relativeAltitude: [10, 20] });
    const interp = createInterpolator(series);
    expect(interp.getAtTime(0.4).relativeAltitude).toBe(10); // within sample 0's own cue (end=0.5)
    expect(interp.getAtTime(4.6).relativeAltitude).toBe(20); // within sample 1's own cue (start=4.5)
    expect(interp.getAtTime(2.5).relativeAltitude).toBeNull(); // inside the gap, no data
  });
});

describe("createInterpolator — circular 360 (heading/course)", () => {
  it("heading 359→1 at the midpoint wraps to 0", () => {
    const series = mkSeries([0, 1], { heading: [359, 1] });
    expect(createInterpolator(series).getAtTime(0.5).heading).toBeCloseTo(0, 9);
  });

  it("heading 1→359 at the midpoint wraps to 0", () => {
    const series = mkSeries([0, 1], { heading: [1, 359] });
    expect(createInterpolator(series).getAtTime(0.5).heading).toBeCloseTo(0, 9);
  });

  it("heading 350→10 at f=0.25 gives 355", () => {
    const series = mkSeries([0, 1], { heading: [350, 10] });
    expect(createInterpolator(series).getAtTime(0.25).heading).toBeCloseTo(355, 9);
  });

  it("a non-wrapping interpolation behaves linearly", () => {
    const series = mkSeries([0, 1], { courseGps: [10, 20] });
    expect(createInterpolator(series).getAtTime(0.5).courseGps).toBeCloseTo(15, 9);
  });
});

describe("createInterpolator — circular 180 (yaw)", () => {
  it("yaw -170→170 at the midpoint wraps to 180 (the short way, not through 0)", () => {
    const series = mkSeries([0, 1], { aircraftYaw: [-170, 170] });
    expect(createInterpolator(series).getAtTime(0.5).aircraftYaw).toBeCloseTo(180, 9);
  });
});

describe("createInterpolator — latitude/longitude pair and the antimeridian", () => {
  it("interpolates lat/lon together, validity keyed off latitude", () => {
    const series = mkSeries([0, 1], { latitude: [10, 20], longitude: [30, 40] });
    const s = createInterpolator(series).getAtTime(0.5);
    expect(s.latitude).toBeCloseTo(15, 9);
    expect(s.longitude).toBeCloseTo(35, 9);
  });

  it("shifts across the antimeridian instead of interpolating the long way around", () => {
    const series = mkSeries([0, 1], { latitude: [0, 0], longitude: [179.9, -179.9] });
    const s = createInterpolator(series).getAtTime(0.5);
    // The short path crosses 180/-180, so the midpoint should land at ±180, not near 0.
    expect(Math.abs(s.longitude as number)).toBeCloseTo(180, 1);
  });
});
