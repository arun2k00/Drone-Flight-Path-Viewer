import { describe, expect, it } from "vitest";
import { computeSyncReport } from "@/lib/telemetry/sync";

function cueBounds(count: number, spacing: number): { start: Float64Array; end: Float64Array } {
  const start = new Float64Array(count);
  const end = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    start[i] = i * spacing;
    end[i] = i * spacing + spacing * 0.5;
  }
  return { start, end };
}

describe("computeSyncReport", () => {
  it("GOOD: telemetry exactly matches the video duration", () => {
    const r = computeSyncReport({
      videoDurationSec: 10,
      fps: 30,
      videoFrameCount: 300,
      telemetry: { timeRange: { start: 0, end: 10 }, sampleCount: 300 },
      cueBounds: cueBounds(300, 10 / 300),
      offsetSec: 0,
    });
    expect(r.status).toBe("GOOD");
  });

  it("WARNING: telemetry ends 1.2s early, coverage ~99%", () => {
    const r = computeSyncReport({
      videoDurationSec: 100,
      fps: 30,
      videoFrameCount: 3000,
      telemetry: { timeRange: { start: 0, end: 98.8 }, sampleCount: 2964 },
      cueBounds: cueBounds(2964, 98.8 / 2964),
      offsetSec: 0,
    });
    expect(r.status).toBe("WARNING");
    expect(r.coverage).toBeGreaterThan(0.9);
    expect(r.messages.some((m) => m.code === "SYNC_DURATION_MISMATCH")).toBe(true);
  });

  it("MISMATCH: telemetry covers only 60% of the video", () => {
    const r = computeSyncReport({
      videoDurationSec: 100,
      fps: 30,
      videoFrameCount: 3000,
      telemetry: { timeRange: { start: 0, end: 60 }, sampleCount: 1800 },
      cueBounds: cueBounds(1800, 60 / 1800),
      offsetSec: 0,
    });
    expect(r.status).toBe("MISMATCH");
    expect(r.messages.some((m) => m.code === "SYNC_LOW_COVERAGE")).toBe(true);
  });

  it("NO_OVERLAP: telemetry shifted 400s away from a 10s video", () => {
    const r = computeSyncReport({
      videoDurationSec: 10,
      fps: 30,
      videoFrameCount: 300,
      telemetry: { timeRange: { start: 0, end: 10 }, sampleCount: 300 },
      cueBounds: cueBounds(300, 10 / 300),
      offsetSec: 400,
    });
    expect(r.status).toBe("NO_OVERLAP");
    expect(r.messages.some((m) => m.code === "SYNC_NO_OVERLAP")).toBe(true);
  });

  it("offsetSec +0.5 shifts startDeltaSec by exactly +0.5", () => {
    const input = {
      videoDurationSec: 10,
      fps: 30,
      videoFrameCount: 300,
      telemetry: { timeRange: { start: 0, end: 10 } as { start: number; end: number }, sampleCount: 300 },
      cueBounds: cueBounds(300, 10 / 300),
    };
    const base = computeSyncReport({ ...input, offsetSec: 0 });
    const shifted = computeSyncReport({ ...input, offsetSec: 0.5 });
    expect(shifted.startDeltaSec - base.startDeltaSec).toBeCloseTo(0.5, 6);
  });

  it("counts gaps greater than 1.0s between consecutive cues", () => {
    const start = Float64Array.from([0, 0.5, 3.0]);
    const end = Float64Array.from([0.1, 0.6, 3.1]);
    const r = computeSyncReport({
      videoDurationSec: 10,
      fps: 30,
      videoFrameCount: 300,
      telemetry: { timeRange: { start: 0, end: 3.1 }, sampleCount: 3 },
      cueBounds: { start, end },
      offsetSec: 0,
    });
    expect(r.gapCount).toBe(1);
    expect(r.longestGapSec).toBeCloseTo(2.4, 6);
    expect(r.messages.some((m) => m.code === "TELEMETRY_GAPS")).toBe(true);
  });
});
