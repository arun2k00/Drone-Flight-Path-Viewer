import { describe, expect, it } from "vitest";
import { deriveGpsSeries } from "@/lib/telemetry/derive";
import { destinationPoint } from "@/lib/telemetry/geo";
import { pointsToSeries } from "@/lib/telemetry/series";
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

describe("deriveGpsSeries", () => {
  it("straight line north at 10 m/s, 30 Hz frames with GPS quantized to 10 Hz", () => {
    const fps = 30;
    const gpsHz = 10;
    const speedMps = 10;
    const durationSec = 3;
    const origin = { latitude: 17.385044, longitude: 78.486671 };
    const frameCount = fps * durationSec;
    const framesPerGpsUpdate = fps / gpsHz;

    const points: TelemetryPoint[] = [];
    for (let i = 0; i < frameCount; i++) {
      const t = i / fps;
      const gpsSampleIndex = Math.floor(i / framesPerGpsUpdate);
      const distanceM = gpsSampleIndex * (framesPerGpsUpdate / fps) * speedMps;
      const pos = destinationPoint(origin.latitude, origin.longitude, 0, distanceM);
      points.push(
        makePoint({ timestamp: t, startTime: t, endTime: t + 1 / fps, latitude: pos.latitude, longitude: pos.longitude, cueOrdinal: i }),
      );
    }

    const timeRange = { start: 0, end: points[points.length - 1].endTime };
    const series = pointsToSeries(points);
    const derived = deriveGpsSeries(series, timeRange);

    // Check an interior sample, away from the clipped edges of the derivation window.
    const mid = Math.floor(frameCount / 2);
    const speed = derived.groundSpeedGps[mid];
    expect(speed).not.toBeNull();
    expect(speed as number).toBeGreaterThanOrEqual(9.5);
    expect(speed as number).toBeLessThanOrEqual(10.5);

    const course = derived.courseGps[mid];
    expect(course).not.toBeNull();
    expect((course as number) < 2 || (course as number) >= 358).toBe(true);
  });

  it("hovering (no movement) gives speed ≈ 0 and a null course", () => {
    const fps = 10;
    const durationSec = 2;
    const origin = { latitude: 17.385044, longitude: 78.486671 };
    const points: TelemetryPoint[] = [];
    for (let i = 0; i < fps * durationSec; i++) {
      const t = i / fps;
      points.push(
        makePoint({ timestamp: t, startTime: t, endTime: t + 1 / fps, latitude: origin.latitude, longitude: origin.longitude, cueOrdinal: i }),
      );
    }

    const timeRange = { start: 0, end: points[points.length - 1].endTime };
    const series = pointsToSeries(points);
    const derived = deriveGpsSeries(series, timeRange);

    const mid = Math.floor(points.length / 2);
    expect(derived.groundSpeedGps[mid]).toBeCloseTo(0, 3);
    expect(derived.courseGps[mid]).toBeNull();
  });
});
