import { describe, expect, it } from "vitest";
import {
  WORST_CASE_STRINGS,
  formatAltitude,
  formatClock,
  formatCoordinate,
  formatDuration,
  formatHeading,
  formatSpeed,
  formatTimecode,
} from "@/lib/telemetry/format";

describe("formatSpeed", () => {
  it("converts 10 m/s to every supported unit", () => {
    expect(formatSpeed(10, "km/h")).toEqual({ value: "36.0", unit: "km/h" });
    expect(formatSpeed(10, "mph")).toEqual({ value: "22.4", unit: "mph" });
    expect(formatSpeed(10, "kn")).toEqual({ value: "19.4", unit: "kn" });
    expect(formatSpeed(10, "m/s")).toEqual({ value: "10.0", unit: "m/s" });
  });

  it("returns the em dash for null", () => {
    expect(formatSpeed(null, "km/h").value).toBe("—");
  });
});

describe("formatAltitude", () => {
  it("formats metres with 1 decimal", () => {
    expect(formatAltitude(42.7, "m")).toBe("42.7");
  });

  it("formats feet with 0 decimals", () => {
    expect(formatAltitude(42.7, "ft")).toBe("140");
  });

  it("returns the em dash for null", () => {
    expect(formatAltitude(null, "m")).toBe("—");
  });
});

describe("formatCoordinate", () => {
  it("formats decimal degrees to 6 decimals", () => {
    expect(formatCoordinate(17.385044, "lat", "decimal")).toBe("17.385044");
  });

  it("formats DMS with hemisphere", () => {
    expect(formatCoordinate(17.385044, "lat", "dms")).toBe(`17°23'06.2"N`);
  });

  it("uses the correct hemisphere letters", () => {
    expect(formatCoordinate(-17.385044, "lat", "dms").endsWith("S")).toBe(true);
    expect(formatCoordinate(78.486671, "lon", "dms").endsWith("E")).toBe(true);
    expect(formatCoordinate(-78.486671, "lon", "dms").endsWith("W")).toBe(true);
  });

  it("returns the em dash for null", () => {
    expect(formatCoordinate(null, "lat", "decimal")).toBe("—");
  });
});

describe("formatHeading", () => {
  it("zero-pads to 3 digits", () => {
    expect(formatHeading(7)).toBe("007°");
    expect(formatHeading(127)).toBe("127°");
  });

  it("returns the em dash for null", () => {
    expect(formatHeading(null)).toBe("—");
  });
});

describe("formatClock", () => {
  it("uses UTC getters on the naive recordedAtMs timestamp", () => {
    const ms = Date.UTC(2026, 4, 27, 13, 42, 18, 0);
    expect(formatClock(ms)).toBe("13:42:18");
  });

  it("returns the em dash for null", () => {
    expect(formatClock(null)).toBe("—");
  });
});

describe("formatDuration / formatTimecode", () => {
  it("formats under an hour as mm:ss, over an hour as h:mm:ss", () => {
    expect(formatDuration(292)).toBe("04:52");
    expect(formatDuration(3723)).toBe("1:02:03");
  });

  it("formatTimecode includes milliseconds", () => {
    expect(formatTimecode(292.533)).toBe("04:52.533");
  });

  it("both return the em dash for null", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatTimecode(null)).toBe("—");
  });
});

describe("WORST_CASE_STRINGS", () => {
  it("provides stable-width strings for panel layout", () => {
    expect(WORST_CASE_STRINGS.latitude).toBe("-89.999999");
    expect(WORST_CASE_STRINGS.longitude).toBe("-179.999999");
    expect(WORST_CASE_STRINGS.altitude).toBe("-9999.9");
    expect(WORST_CASE_STRINGS.speed).toBe("999.9");
    expect(WORST_CASE_STRINGS.heading).toBe("359°");
    expect(WORST_CASE_STRINGS.clock).toBe("23:59:59");
    expect(WORST_CASE_STRINGS.units).toBe("km/h");
  });
});
