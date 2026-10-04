import { describe, expect, it } from "vitest";
import { maxOf, minOf, parseTelemetryNumber } from "@/lib/telemetry/numbers";

describe("parseTelemetryNumber", () => {
  it("accepts an unambiguous decimal comma", () => {
    expect(parseTelemetryNumber("42,700")).toEqual({ value: 42.7, unit: null });
  });

  it("rejects a fraction like a shutter speed", () => {
    expect(parseTelemetryNumber("1/320.0")).toBeNull();
  });

  it("parses a value with a unit", () => {
    expect(parseTelemetryNumber("2.50m/s")).toEqual({ value: 2.5, unit: "m/s" });
  });

  it("parses km/h with a space", () => {
    expect(parseTelemetryNumber("36 km/h")).toEqual({ value: 36, unit: "km/h" });
  });

  it("rejects non-numeric text", () => {
    expect(parseTelemetryNumber("abc")).toBeNull();
    expect(parseTelemetryNumber("dlog_m")).toBeNull();
    expect(parseTelemetryNumber("F2.8")).toBeNull();
  });

  it("parses negative numbers", () => {
    expect(parseTelemetryNumber("-128.769")).toEqual({ value: -128.769, unit: null });
  });
});

describe("minOf / maxOf", () => {
  it("match Math.min / Math.max, including the empty case", () => {
    expect(minOf([3, -1, 2])).toBe(-1);
    expect(maxOf(Float64Array.from([3, -1, 2]))).toBe(3);
    expect(minOf([])).toBe(Infinity);
    expect(maxOf([])).toBe(-Infinity);
  });

  it("handle one value per cue of a long 60 fps flight (spreading these overflows the stack)", () => {
    const values = Array.from({ length: 300_000 }, (_, i) => i % 1000);
    expect(minOf(values)).toBe(0);
    expect(maxOf(values)).toBe(999);
  });
});
