import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTelemetry } from "@/lib/telemetry/parser";
import { buildSummary } from "@/lib/telemetry/summary";
import type { TelemetryPoint } from "@/types/telemetry";

describe("buildSummary", () => {
  it("summarizes a 300k-sample flight (one cue per frame for ~83 min at 60 fps) without overflowing the stack", () => {
    const { report } = parseTelemetry(new Uint8Array(readFileSync("tests/fixtures/srt/dji-air3s-25fps.SRT")), { coordinateOrder: "auto" });
    const n = 300_000;
    const points: TelemetryPoint[] = Array.from({ length: n }, (_, i) => ({
      timestamp: (i + 0.5) / 60,
      startTime: i / 60,
      endTime: (i + 1) / 60,
      latitude: 17 + (i % 100) * 1e-5,
      longitude: 78 + (i % 200) * 1e-5,
      relativeAltitude: i % 120,
      absoluteAltitude: 500 + (i % 120),
      speedX: null,
      speedY: null,
      speedZ: null,
      speed: (i % 15) + 0.5,
      heading: null,
      aircraftPitch: null,
      aircraftRoll: null,
      aircraftYaw: null,
      gimbalPitch: null,
      gimbalRoll: null,
      gimbalYaw: null,
      recordedAt: null,
      frameIndex: i + 1,
      cueOrdinal: i,
    }));
    const derived = { groundSpeedGps: new Array<number | null>(n).fill(null), courseGps: new Array<number | null>(n).fill(null) };
    const summary = buildSummary(points, new Array<boolean>(n).fill(false), derived, report, { start: 0, end: n / 60 }, null);

    expect(summary.bounds).toEqual({ minLat: 17, maxLat: 17 + 99e-5, minLon: 78, maxLon: 78 + 199e-5 });
    expect(summary.relativeAltitudeRange).toEqual({ min: 0, max: 119 });
    expect(summary.absoluteAltitudeRange).toEqual({ min: 500, max: 619 });
    expect(summary.maxSpeedMps).toBe(14.5);
  });
});
