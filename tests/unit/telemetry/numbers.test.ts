import { describe, expect, it } from "vitest";
import { parseTelemetryNumber } from "@/lib/telemetry/numbers";

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
