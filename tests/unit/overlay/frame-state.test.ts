import { describe, expect, it } from "vitest";
import { createInterpolator } from "@/lib/telemetry/interpolator";
import { buildFrameState } from "@/lib/overlay/frame-state";
import type { TelemetrySeries } from "@/lib/telemetry/series";
import { DEFAULT_TELEMETRY_SETTINGS, type TelemetryCapabilities } from "@/types/telemetry";

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

const CAPS: TelemetryCapabilities = {
  gps: true,
  relativeAltitude: true,
  absoluteAltitude: true,
  speed: "srt",
  heading: "srt",
  course: true,
  attitude: false,
  gimbal: false,
  recordedAt: false,
};

describe("buildFrameState", () => {
  it("applies the offset: srtTime = videoTime - offsetSec", () => {
    const series = mkSeries([0, 10], { relativeAltitude: [0, 100] });
    const interpolator = createInterpolator(series, { maxGapSec: 20 });
    const settings = { ...DEFAULT_TELEMETRY_SETTINGS, offsetSec: 2 };
    // videoTime=7 with offset=2 -> srtTime=5 -> halfway between 0 and 10 -> 50
    const frame = buildFrameState(7, interpolator, settings, { altitudeSource: "relative" }, CAPS);
    expect(frame.display.altitude).toBeCloseTo(50, 9);
  });

  it("resolves altitude from the configured source", () => {
    const series = mkSeries([0], { relativeAltitude: [10], absoluteAltitude: [500] });
    const interpolator = createInterpolator(series);
    const relative = buildFrameState(0, interpolator, DEFAULT_TELEMETRY_SETTINGS, { altitudeSource: "relative" }, CAPS);
    const absolute = buildFrameState(0, interpolator, DEFAULT_TELEMETRY_SETTINGS, { altitudeSource: "absolute" }, CAPS);
    expect(relative.display.altitude).toBe(10);
    expect(absolute.display.altitude).toBe(500);
  });

  it("speed source auto falls back to gps-derived when SRT speed is absent", () => {
    const series = mkSeries([0], { groundSpeedGps: [12.5] });
    const interpolator = createInterpolator(series);
    const auto = buildFrameState(0, interpolator, { ...DEFAULT_TELEMETRY_SETTINGS, speedSource: "auto" }, { altitudeSource: "relative" }, CAPS);
    expect(auto.display.speedMps).toBe(12.5);
    expect(auto.display.speedSource).toBe("gps-derived");
  });

  it("speed source srt-only never falls back to gps-derived", () => {
    const series = mkSeries([0], { groundSpeedGps: [12.5] });
    const interpolator = createInterpolator(series);
    const srtOnly = buildFrameState(
      0,
      interpolator,
      { ...DEFAULT_TELEMETRY_SETTINGS, speedSource: "srt-only" },
      { altitudeSource: "relative" },
      CAPS,
    );
    expect(srtOnly.display.speedMps).toBeNull();
    expect(srtOnly.display.speedSource).toBeNull();
  });

  it("prefers SRT speed over GPS-derived when both are present", () => {
    const series = mkSeries([0], { speed: [8], groundSpeedGps: [12.5] });
    const interpolator = createInterpolator(series);
    const frame = buildFrameState(0, interpolator, { ...DEFAULT_TELEMETRY_SETTINGS, speedSource: "auto" }, { altitudeSource: "relative" }, CAPS);
    expect(frame.display.speedMps).toBe(8);
    expect(frame.display.speedSource).toBe("srt");
  });

  it("heading fallback none leaves heading null when SRT has no heading", () => {
    const series = mkSeries([0], { courseGps: [123] });
    const interpolator = createInterpolator(series);
    const frame = buildFrameState(0, interpolator, { ...DEFAULT_TELEMETRY_SETTINGS, headingFallback: "none" }, { altitudeSource: "relative" }, CAPS);
    expect(frame.display.heading).toBeNull();
    expect(frame.display.headingSource).toBeNull();
  });

  it("heading fallback gps-course (TRK) uses the derived course when SRT has no heading", () => {
    const series = mkSeries([0], { courseGps: [123] });
    const interpolator = createInterpolator(series);
    const frame = buildFrameState(
      0,
      interpolator,
      { ...DEFAULT_TELEMETRY_SETTINGS, headingFallback: "gps-course" },
      { altitudeSource: "relative" },
      CAPS,
    );
    expect(frame.display.heading).toBe(123);
    expect(frame.display.headingSource).toBe("gps-course");
  });

  it("SRT heading always wins over the gps-course fallback", () => {
    const series = mkSeries([0], { heading: [45], courseGps: [123] });
    const interpolator = createInterpolator(series);
    const frame = buildFrameState(
      0,
      interpolator,
      { ...DEFAULT_TELEMETRY_SETTINGS, headingFallback: "gps-course" },
      { altitudeSource: "relative" },
      CAPS,
    );
    expect(frame.display.heading).toBe(45);
    expect(frame.display.headingSource).toBe("srt");
  });
});
