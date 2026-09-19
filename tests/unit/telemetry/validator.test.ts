import { describe, expect, it } from "vitest";
import { validateRecord } from "@/lib/telemetry/validator";
import type { ExtractedField } from "@/lib/telemetry/strategies/types";

function fields(pairs: Record<string, string>): ExtractedField[] {
  return Object.entries(pairs).map(([key, raw]) => ({ key, raw }));
}

describe("validateRecord — GPS", () => {
  it("valid coordinates", () => {
    const r = validateRecord(fields({ latitude: "17.38", longitude: "78.48" }), 0);
    expect(r.fields.latitude).toBeCloseTo(17.38, 6);
    expect(r.fields.longitude).toBeCloseTo(78.48, 6);
    expect(r.issues).toHaveLength(0);
  });

  it("boundary values are valid", () => {
    expect(validateRecord(fields({ latitude: "90", longitude: "180" }), 0).fields.latitude).toBe(90);
    expect(validateRecord(fields({ latitude: "-90", longitude: "-180" }), 0).fields.longitude).toBe(-180);
  });

  it("out of range latitude", () => {
    const r = validateRecord(fields({ latitude: "90.0001", longitude: "0" }), 0);
    expect(r.fields.latitude).toBeNull();
    expect(r.issues[0].code).toBe("GPS_OUT_OF_RANGE");
  });

  it("out of range longitude", () => {
    const r = validateRecord(fields({ latitude: "0", longitude: "180.5" }), 0);
    expect(r.fields.longitude).toBeNull();
    expect(r.issues[0].code).toBe("GPS_OUT_OF_RANGE");
  });

  it("(0, 0) is treated as no fix, never as a position", () => {
    const r = validateRecord(fields({ latitude: "0", longitude: "0" }), 0);
    expect(r.fields.latitude).toBeNull();
    expect(r.issues[0].code).toBe("GPS_NO_FIX");
  });

  it("an unparseable latitude (NaN) is partial, like a missing one", () => {
    const r = validateRecord(fields({ latitude: "NaN", longitude: "78.48" }), 0);
    expect(r.fields.latitude).toBeNull();
    expect(r.issues[0].code).toBe("GPS_PARTIAL");
  });

  it("latitude without longitude is partial", () => {
    const r = validateRecord(fields({ latitude: "17.38" }), 0);
    expect(r.fields.latitude).toBeNull();
    expect(r.issues[0].code).toBe("GPS_PARTIAL");
  });
});

describe("validateRecord — altitude and speed ranges", () => {
  it("relativeAltitude out of range is dropped", () => {
    const r = validateRecord(fields({ rel_alt: "12001" }), 0);
    expect(r.fields.relativeAltitude).toBeNull();
    expect(r.issues.some((i) => i.code === "VALUE_OUT_OF_RANGE" && i.field === "relativeAltitude")).toBe(true);
  });

  it("relativeAltitude at the boundary is kept", () => {
    const r = validateRecord(fields({ rel_alt: "-1000" }), 0);
    expect(r.fields.relativeAltitude).toBe(-1000);
  });

  it("speed out of range is dropped", () => {
    const r = validateRecord(fields({ speed: "200" }), 0);
    expect(r.fields.speed).toBeNull();
    expect(r.issues.some((i) => i.code === "VALUE_OUT_OF_RANGE" && i.field === "speed")).toBe(true);
  });

  it("negative speed is invalid (speed is a magnitude)", () => {
    const r = validateRecord(fields({ speed: "-1" }), 0);
    expect(r.fields.speed).toBeNull();
  });
});

describe("validateRecord — yaw/heading normalization", () => {
  it("heading falls back to normalized aircraftYaw when no explicit heading key", () => {
    const r = validateRecord(fields({ yaw: "-170" }), 0);
    expect(r.fields.aircraftYaw).toBeCloseTo(-170, 6);
    expect(r.fields.heading).toBeCloseTo(190, 6);
  });

  it("heading 540 normalizes to 180", () => {
    const r = validateRecord(fields({ heading: "540" }), 0);
    expect(r.fields.heading).toBeCloseTo(180, 6);
  });

  it("gimbal yaw never becomes heading", () => {
    const r = validateRecord(fields({ gb_yaw: "45" }), 0);
    expect(r.fields.gimbalYaw).toBe(45);
    expect(r.fields.heading).toBeNull();
  });

  it("an explicit heading key wins over aircraftYaw", () => {
    const r = validateRecord(fields({ heading: "90", yaw: "-170" }), 0);
    expect(r.fields.heading).toBe(90);
  });
});

describe("validateRecord — speed from components", () => {
  it("derives horizontal speed from vx/vy, never 3D", () => {
    const r = validateRecord(fields({ drone_speedx: "3", drone_speedy: "4", drone_speedz: "-1" }), 0);
    expect(r.fields.speed).toBeCloseTo(5, 6); // hypot(3,4), not hypot(3,4,-1)
    expect(r.fields.speedFromComponents).toBe(true);
  });

  it("an explicit speed key takes priority over components", () => {
    const r = validateRecord(fields({ speed: "2.5", drone_speedx: "3", drone_speedy: "4" }), 0);
    expect(r.fields.speed).toBe(2.5);
    expect(r.fields.speedFromComponents).toBe(false);
  });
});

describe("validateRecord — unknown and duplicate keys", () => {
  it("collects unknown keys lower-cased", () => {
    const r = validateRecord(fields({ color_md: "hlg" }), 0);
    expect(r.unknownKeys).toEqual(["color_md"]);
    expect(r.mappedCount).toBe(0);
  });

  it("keeps the first occurrence of a duplicated target and issues DUPLICATE_KEY", () => {
    const r = validateRecord([{ key: "lat", raw: "10" }, { key: "latitude", raw: "20" }, { key: "longitude", raw: "0" }], 0);
    expect(r.fields.latitude).toBe(10);
    expect(r.issues.some((i) => i.code === "DUPLICATE_KEY")).toBe(true);
  });
});
