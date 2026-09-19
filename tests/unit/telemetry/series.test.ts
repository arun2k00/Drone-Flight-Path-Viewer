import { describe, expect, it } from "vitest";
import { pointsToSeries, seriesFromJson, toSeriesJson } from "@/lib/telemetry/series";
import type { TelemetryPoint } from "@/types/telemetry";

function makePoint(overrides: Partial<TelemetryPoint>): TelemetryPoint {
  return {
    timestamp: 0,
    startTime: 0,
    endTime: 0,
    latitude: null,
    longitude: null,
    relativeAltitude: null,
    absoluteAltitude: null,
    speedX: null,
    speedY: null,
    speedZ: null,
    speed: null,
    heading: null,
    aircraftPitch: null,
    aircraftRoll: null,
    aircraftYaw: null,
    gimbalPitch: null,
    gimbalRoll: null,
    gimbalYaw: null,
    recordedAt: null,
    frameIndex: null,
    cueOrdinal: 0,
    ...overrides,
  };
}

describe("series JSON round-trip", () => {
  it("rounds lat/lon to 7 decimals, times to 6, other numbers to 3, and preserves null", () => {
    const points: TelemetryPoint[] = [
      makePoint({
        timestamp: 0.123456789,
        startTime: 0.1,
        endTime: 0.14,
        latitude: 17.3850441234,
        longitude: 78.4866711234,
        relativeAltitude: 42.7123,
        absoluteAltitude: null,
        cueOrdinal: 0,
      }),
      makePoint({
        timestamp: 1.0,
        startTime: 0.98,
        endTime: 1.02,
        latitude: null,
        longitude: null,
        relativeAltitude: null,
        absoluteAltitude: -128.7691,
        cueOrdinal: 1,
      }),
    ];
    const derived = { groundSpeedGps: [9.1234, null], courseGps: [null, 44.5678] };
    const json = toSeriesJson(points, derived);

    expect(json.latitude[0]).toBeCloseTo(17.3850441, 7);
    expect(json.latitude[1]).toBeNull();
    expect(json.t[0]).toBeCloseTo(0.123457, 6);
    expect(json.relativeAltitude[0]).toBeCloseTo(42.712, 3);
    expect(json.absoluteAltitude[1]).toBeCloseTo(-128.769, 3);
    expect(json.groundSpeedGps[0]).toBeCloseTo(9.123, 3);
    expect(json.groundSpeedGps[1]).toBeNull();
    expect(json.courseGps[0]).toBeNull();
    expect(json.courseGps[1]).toBeCloseTo(44.568, 3);

    const series = seriesFromJson(json);
    expect(series.length).toBe(2);
    expect(series.latitude[0]).toBeCloseTo(17.385044, 6);
    expect(Number.isNaN(series.latitude[1])).toBe(true);
    expect(series.groundSpeedGps[0]).toBeCloseTo(9.123, 3);
    expect(Number.isNaN(series.groundSpeedGps[1])).toBe(true);
  });

  it("round-trips recordedAtMs as an integer", () => {
    const points = [makePoint({ recordedAt: "2026-05-27 13:14:22.991", cueOrdinal: 0 })];
    const json = toSeriesJson(points, { groundSpeedGps: [null], courseGps: [null] });
    expect(Number.isInteger(json.recordedAtMs[0])).toBe(true);
    const series = seriesFromJson(json);
    expect(series.recordedAtMs[0]).toBe(json.recordedAtMs[0]);
  });

  it("passes frameIndex through unrounded", () => {
    const points = [makePoint({ frameIndex: 12, cueOrdinal: 0 }), makePoint({ frameIndex: null, cueOrdinal: 1 })];
    const json = toSeriesJson(points, { groundSpeedGps: [null, null], courseGps: [null, null] });
    expect(json.frameIndex).toEqual([12, null]);
  });
});

describe("pointsToSeries", () => {
  it("maps null fields to NaN", () => {
    const series = pointsToSeries([makePoint({ latitude: null, cueOrdinal: 0 })]);
    expect(Number.isNaN(series.latitude[0])).toBe(true);
  });

  it("maps present values through unchanged", () => {
    const series = pointsToSeries([makePoint({ latitude: 17.385044, cueOrdinal: 0 })]);
    expect(series.latitude[0]).toBeCloseTo(17.385044, 6);
  });

  it("initializes groundSpeedGps/courseGps as NaN until derive.ts fills them", () => {
    const series = pointsToSeries([makePoint({ cueOrdinal: 0 })]);
    expect(Number.isNaN(series.groundSpeedGps[0])).toBe(true);
    expect(Number.isNaN(series.courseGps[0])).toBe(true);
  });
});
