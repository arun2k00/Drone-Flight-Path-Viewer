import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { createInterpolator } from "@/lib/telemetry/interpolator";
import { parseTelemetry } from "@/lib/telemetry/parser";
import { pointsToSeries, type TelemetrySeries } from "@/lib/telemetry/series";
import { parseSrtTimestamp } from "@/lib/telemetry/srt-cues";

const FIXTURES = path.join(process.cwd(), "tests", "fixtures", "srt");

function load(name: string, settings: { coordinateOrder: "auto" | "lat-lon" | "lon-lat" } = { coordinateOrder: "auto" }) {
  const bytes = fs.readFileSync(path.join(FIXTURES, name));
  return parseTelemetry(new Uint8Array(bytes), settings);
}

describe("dji-air3s-25fps.SRT", () => {
  const r = load("dji-air3s-25fps.SRT");
  const p = r.points;

  it("detects DJI_SRT_BRACKET", () => {
    expect(r.report.parserId).toBe("DJI_SRT_BRACKET");
  });

  it("counts 30 total/parsed, 0 ignored/invalid", () => {
    expect(r.report.totalCues).toBe(30);
    expect(r.report.parsedRecords).toBe(30);
    expect(r.report.ignoredCues).toBe(0);
    expect(r.report.invalidRecords).toBe(0);
  });

  it("counts GPS_NO_FIX twice (before lock)", () => {
    expect(r.report.issueCounts.GPS_NO_FIX).toBe(2);
  });

  it("cue 1-2 have no GPS fix yet", () => {
    expect(p[0].latitude).toBeNull();
    expect(p[0].relativeAltitude).toBe(0);
    expect(p[0].absoluteAltitude).toBeCloseTo(-128.769, 3);
  });

  it("cue 3 values", () => {
    expect(p[2].timestamp).toBeCloseTo(0.1, 6);
    expect(p[2].startTime).toBeCloseTo(0.08, 6);
    expect(p[2].endTime).toBeCloseTo(0.12, 6);
    expect(p[2].latitude).toBeCloseTo(17.385044, 6);
    expect(p[2].longitude).toBeCloseTo(78.486671, 6);
    expect(p[2].relativeAltitude).toBeCloseTo(42.7, 3);
    expect(p[2].absoluteAltitude).toBeCloseTo(518.2, 3);
    expect(p[2].frameIndex).toBe(3);
    expect(p[2].recordedAt).toBe("2026-05-27 13:14:22.991");
  });

  it("cue 30 values", () => {
    expect(p[29].latitude).toBeCloseTo(17.385109, 6);
    expect(p[29].longitude).toBeCloseTo(78.486736, 6);
    expect(p[29].relativeAltitude).toBeCloseTo(44.0, 3);
    expect(p[29].absoluteAltitude).toBeCloseTo(519.5, 3);
    expect(p[29].recordedAt).toBe("2026-05-27 13:14:24.071");
  });

  it("has no SRT speed or heading anywhere", () => {
    expect(p.every((x) => x.speed === null && x.heading === null)).toBe(true);
  });

  it("timeRange/median/rate", () => {
    expect(r.summary.timeRange.start).toBeCloseTo(0, 6);
    expect(r.summary.timeRange.end).toBeCloseTo(1.2, 6);
    expect(r.summary.medianIntervalSec).toBeCloseTo(0.04, 6);
    expect(r.summary.estimatedRateHz).toBeCloseTo(25, 5);
  });

  it("capabilities", () => {
    const c = r.summary.capabilities;
    expect(c.gps).toBe(true);
    expect(c.relativeAltitude).toBe(true);
    expect(c.absoluteAltitude).toBe(true);
    expect(c.speed).toBe("gps-derived");
    expect(c.heading).toBe("none");
    expect(c.course).toBe(true);
  });

  it("derived speed at cue 16 is in [8.8, 10.4]", () => {
    expect(r.derived.groundSpeedGps[15]).toBeGreaterThanOrEqual(8.8);
    expect(r.derived.groundSpeedGps[15]).toBeLessThanOrEqual(10.4);
  });

  it("derived course at cue 16 is in [42, 46]", () => {
    expect(r.derived.courseGps[15]).toBeGreaterThanOrEqual(42);
    expect(r.derived.courseGps[15]).toBeLessThanOrEqual(46);
  });

  it("warns SPEED_DERIVED_FROM_GPS, HEADING_UNAVAILABLE, GPS_INCOMPLETE", () => {
    const codes = r.summary.warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(["SPEED_DERIVED_FROM_GPS", "HEADING_UNAVAILABLE", "GPS_INCOMPLETE"]));
  });

  it("unknownKeys includes camera fields", () => {
    expect(r.report.unknownKeys).toEqual(
      expect.arrayContaining(["iso", "shutter", "fnum", "ev", "color_md", "focal_len", "ct"]),
    );
  });
});

describe("dji-mini4pro-60fps.SRT", () => {
  const r = load("dji-mini4pro-60fps.SRT");

  it("parser + 6 parsed", () => {
    expect(r.report.parserId).toBe("DJI_SRT_BRACKET");
    expect(r.report.parsedRecords).toBe(6);
  });

  it("cue 3 timing", () => {
    expect(r.points[2].timestamp).toBeCloseTo(0.0405, 6);
    expect(r.points[2].startTime).toBeCloseTo(0.032, 6);
    expect(r.points[2].endTime).toBeCloseTo(0.049, 6);
  });

  it("frameIndex 1..6", () => {
    expect(r.points.map((p) => p.frameIndex).join(",")).toBe("1,2,3,4,5,6");
  });

  it("altitudes", () => {
    expect(r.points[0].relativeAltitude).toBeCloseTo(5.3, 3);
    expect(r.points[0].absoluteAltitude).toBeCloseTo(23.057, 3);
  });

  it("cue 4 latitude", () => {
    expect(r.points[3].latitude).toBeCloseTo(17.385045, 6);
  });

  it("estimated rate in [59, 61.5]", () => {
    expect(r.summary.estimatedRateHz).toBeGreaterThanOrEqual(59);
    expect(r.summary.estimatedRateHz).toBeLessThanOrEqual(61.5);
  });
});

describe("dji-mavic3-srtcnt.SRT", () => {
  const r = load("dji-mavic3-srtcnt.SRT");

  it("parser + 4 parsed", () => {
    expect(r.report.parserId).toBe("DJI_SRT_BRACKET");
    expect(r.report.parsedRecords).toBe(4);
  });

  it("frameIndex from SrtCnt", () => {
    expect(r.points.map((p) => p.frameIndex).join(",")).toBe("1,2,3,4");
  });

  it("recordedAt drops microseconds", () => {
    expect(r.points[0].recordedAt).toBe("2024-01-15 14:30:22.123");
  });

  it("altitudes + cue 4 latitude", () => {
    expect(r.points[0].relativeAltitude).toBeCloseTo(10.2, 3);
    expect(r.points[0].absoluteAltitude).toBeCloseTo(142.76, 3);
    expect(r.points[3].latitude).toBeCloseTo(17.38505, 6);
  });
});

describe("dji-mavic-air-longtitude.SRT", () => {
  const r = load("dji-mavic-air-longtitude.SRT");

  it("'longtitude' typo maps to longitude", () => {
    expect(r.points[0].longitude).toBeCloseTo(78.486671, 6);
  });

  it("'altitude' maps to absolute only", () => {
    expect(r.points[0].absoluteAltitude).toBeCloseTo(245.3, 3);
    expect(r.points.every((p) => p.relativeAltitude === null)).toBe(true);
  });

  it("capabilities reflect absolute-only altitude", () => {
    expect(r.summary.capabilities.relativeAltitude).toBe(false);
    expect(r.summary.capabilities.absoluteAltitude).toBe(true);
  });
});

describe("dji-enterprise-attitude.SRT", () => {
  const r = load("dji-enterprise-attitude.SRT");
  const p0 = r.points[0];

  it("speed components + horizontal speed 5.0 (not hypot with z)", () => {
    expect(p0.speedX).toBe(3);
    expect(p0.speedY).toBe(4);
    expect(p0.speedZ).toBe(-1);
    expect(p0.speed).toBeCloseTo(5.0, 6);
  });

  it("attitude + gimbal, heading from yaw", () => {
    expect(p0.aircraftYaw).toBeCloseTo(-170, 6);
    expect(p0.heading).toBeCloseTo(190, 6);
    expect(p0.aircraftPitch).toBeCloseTo(-5.2, 6);
    expect(p0.aircraftRoll).toBeCloseTo(1.1, 6);
    expect(p0.gimbalYaw).toBeCloseTo(-170.3, 6);
    expect(p0.gimbalPitch).toBe(-90);
    expect(p0.gimbalRoll).toBe(0);
  });

  it("capabilities", () => {
    expect(r.summary.capabilities.speed).toBe("srt-components");
    expect(r.summary.capabilities.heading).toBe("srt");
    expect(r.summary.capabilities.attitude).toBe(true);
    expect(r.summary.capabilities.gimbal).toBe(true);
  });

  it("interpolates heading and yaw at the cue 1/2 midpoint", () => {
    const series = pointsSeries(r);
    const s = createInterpolator(series).getAtTime(0.033);
    expect(s.heading).toBeCloseTo(180, 5);
    expect(s.aircraftYaw).toBeCloseTo(180, 5);
  });
});

describe("dji-p4rtk-inline.SRT", () => {
  const r = load("dji-p4rtk-inline.SRT");
  const p0 = r.points[0];

  it("parser inline + order assumed", () => {
    expect(r.report.parserId).toBe("DJI_SRT_INLINE");
    expect(r.report.issueCounts.GPS_TUPLE_ORDER_ASSUMED).toBe(1);
    expect(r.report.coordinateOrder).toBe("lon-lat");
    expect(r.summary.warnings.map((w) => w.code)).toContain("GPS_TUPLE_ORDER_ASSUMED");
  });

  it("cue 1 values", () => {
    expect(p0.latitude).toBeCloseTo(-34.237922, 6);
    expect(p0.longitude).toBeCloseTo(-58.851745, 6);
    expect(p0.relativeAltitude).toBeCloseTo(85.8, 3);
    expect(p0.speed).toBeCloseTo(2.5, 3);
    expect(p0.speedZ).toBe(0);
    expect(p0.aircraftPitch).toBeCloseTo(2.7, 3);
    expect(p0.aircraftRoll).toBeCloseTo(-7.0, 3);
    expect(p0.aircraftYaw).toBeCloseTo(110.1, 3);
    expect(p0.heading).toBeCloseTo(110.1, 3);
    expect(p0.gimbalPitch).toBeCloseTo(-24.4, 3);
    expect(p0.gimbalRoll).toBe(0);
    expect(p0.gimbalYaw).toBeCloseTo(110.4, 3);
    expect(p0.timestamp).toBeCloseTo(0.5, 6);
  });

  it("speed capability is 'srt' (explicit key, not components)", () => {
    expect(r.summary.capabilities.speed).toBe("srt");
  });

  it("unknownKeys", () => {
    expect(r.report.unknownKeys).toEqual(expect.arrayContaining(["home", "d", "iso", "ss", "ev"]));
  });

  it("coordinateOrder override to lat-lon removes the warning", () => {
    const r2 = load("dji-p4rtk-inline.SRT", { coordinateOrder: "lat-lon" });
    expect(r2.points[0].latitude).toBeCloseTo(-58.851745, 6);
    expect(r2.points[0].longitude).toBeCloseTo(-34.237922, 6);
    expect(r2.report.issueCounts.GPS_TUPLE_ORDER_ASSUMED).toBeUndefined();
  });
});

describe("dji-phantom3-legacy.SRT", () => {
  const r = load("dji-phantom3-legacy.SRT");
  const p0 = r.points[0];

  it("inline, lon-lat auto-detected (|139.69| > 90), no warning", () => {
    expect(r.report.parserId).toBe("DJI_SRT_INLINE");
    expect(r.report.coordinateOrder).toBe("lon-lat");
    expect(r.report.issueCounts.GPS_TUPLE_ORDER_ASSUMED).toBeUndefined();
  });

  it("cue 1", () => {
    expect(p0.latitude).toBeCloseTo(35.6896, 6);
    expect(p0.longitude).toBeCloseTo(139.6917, 6);
    expect(p0.relativeAltitude).toBeCloseTo(1.9, 3);
    expect(p0.timestamp).toBeCloseTo(1.5, 6);
    expect(p0.startTime).toBe(1);
    expect(p0.recordedAt).toBe("2017-08-05 14:11:51.000");
  });

  it("cue 4 relativeAltitude", () => {
    expect(r.points[3].relativeAltitude).toBeCloseTo(3.5, 3);
  });
});

describe("missing-gps.SRT", () => {
  const r = load("missing-gps.SRT");

  it("5 parsed, no GPS, relative altitude range", () => {
    expect(r.report.parsedRecords).toBe(5);
    expect(r.summary.capabilities.gps).toBe(false);
    expect(r.summary.relativeAltitudeRange?.min).toBeCloseTo(12, 3);
    expect(r.summary.relativeAltitudeRange?.max).toBeCloseTo(12.4, 3);
  });

  it("speed/heading none + TELEMETRY_NO_GPS warning", () => {
    expect(r.summary.capabilities.speed).toBe("none");
    expect(r.summary.capabilities.heading).toBe("none");
    expect(r.summary.warnings.map((w) => w.code)).toContain("TELEMETRY_NO_GPS");
  });
});

describe("missing-altitude.SRT", () => {
  it("gps yes, altitudes no", () => {
    const r = load("missing-altitude.SRT");
    expect(r.report.parsedRecords).toBe(5);
    expect(r.summary.capabilities.gps).toBe(true);
    expect(r.summary.capabilities.relativeAltitude).toBe(false);
    expect(r.summary.capabilities.absoluteAltitude).toBe(false);
  });
});

describe("malformed-records.SRT", () => {
  const r = load("malformed-records.SRT");

  it("counts 7 total, 3 parsed, 2 ignored, 2 invalid", () => {
    expect(r.report.totalCues).toBe(7);
    expect(r.report.parsedRecords).toBe(3);
    expect(r.report.ignoredCues).toBe(2);
    expect(r.report.invalidRecords).toBe(2);
  });

  it("issue codes", () => {
    expect(r.report.issueCounts.EMPTY_PAYLOAD).toBe(1);
    expect(r.report.issueCounts.NO_FIELDS).toBe(1);
    expect(r.report.issueCounts.BAD_TIMESTAMP).toBe(1);
    expect(r.report.issueCounts.END_BEFORE_START).toBe(1);
    expect(r.report.issueCounts.GPS_PARTIAL).toBe(1);
  });

  it("only cues 1, 4, 7 survive (via debug record index)", () => {
    const parsedIndices = r.debug.filter((d) => d.status === "parsed").map((d) => d.index);
    expect(parsedIndices.join(",")).toBe("1,4,7");
  });

  it("cue 4 has no GPS but relativeAltitude 10.3; cue 7 has latitude", () => {
    expect(r.points[1].latitude).toBeNull();
    expect(r.points[1].relativeAltitude).toBeCloseTo(10.3, 3);
    expect(r.points[2].latitude).toBeCloseTo(17.385048, 6);
  });
});

describe("unknown-fields.SRT", () => {
  const r = load("unknown-fields.SRT");

  it("gimbal parsed but heading stays null (gimbal yaw is not heading)", () => {
    expect(r.points[0].gimbalYaw).toBe(45);
    expect(r.points[0].gimbalPitch).toBe(-30);
    expect(r.points.every((p) => p.heading === null)).toBe(true);
  });

  it("unknownKeys", () => {
    expect(r.report.unknownKeys).toEqual(expect.arrayContaining(["dzoom_ratio", "pp_roll", "pp_pitch", "frameid", "tint", "ct"]));
  });
});

describe("generic-kv.SRT", () => {
  it("generic parser values", () => {
    const r = load("generic-kv.SRT");
    const p0 = r.points[0];
    expect(r.report.parserId).toBe("GENERIC_KEY_VALUE");
    expect(p0.latitude).toBeCloseTo(17.385044, 6);
    expect(p0.longitude).toBeCloseTo(78.486671, 6);
    expect(p0.absoluteAltitude).toBeCloseTo(40, 3);
    expect(p0.speed).toBeCloseTo(5.5, 3);
    expect(r.summary.capabilities.speed).toBe("srt");
  });
});

describe("not-telemetry.SRT", () => {
  it("throws TELEMETRY_NO_RECOGNIZED_FIELDS", () => {
    try {
      load("not-telemetry.SRT");
      throw new Error("expected parseTelemetry to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("TELEMETRY_NO_RECOGNIZED_FIELDS");
    }
  });
});

describe("decimal-comma.SRT", () => {
  it("decimal commas parse as decimal points", () => {
    const r = load("decimal-comma.SRT");
    expect(r.points[0].latitude).toBeCloseTo(17.385044, 6);
    expect(r.points[0].longitude).toBeCloseTo(78.486671, 6);
    expect(r.points[0].relativeAltitude).toBeCloseTo(42.7, 3);
    expect(r.points[0].absoluteAltitude).toBeCloseTo(518.2, 3);
    expect(r.points[2].latitude).toBeCloseTo(17.385046, 6);
  });
});

describe("gps-spike.SRT", () => {
  const r = load("gps-spike.SRT");

  it("cue 4 spike is nulled and nothing else", () => {
    expect(r.points[3].latitude).toBeNull();
    expect(r.report.issueCounts.GPS_SPIKE).toBe(1);
    expect(r.points.filter((p) => p.latitude !== null).length).toBe(6);
  });

  it("bounds exclude the spike", () => {
    expect(r.summary.bounds?.maxLat).toBeCloseTo(17.38527, 6);
  });
});

describe("gps-gap.SRT", () => {
  const r = load("gps-gap.SRT");
  const it_ = createInterpolator(pointsSeries(r));

  it("GPS_NO_FIX 4 (cues 4-7)", () => {
    expect(r.report.issueCounts.GPS_NO_FIX).toBe(4);
  });

  it("latitude is null inside the 5 s gap at t=5.0", () => {
    expect(it_.getAtTime(5.0).latitude).toBeNull();
  });

  it("holds within cue 3's bounds at t=2.9", () => {
    expect(it_.getAtTime(2.9).latitude).toBeCloseTo(17.38509, 6);
  });

  it("holds within cue 8's bounds at t=7.2", () => {
    expect(it_.getAtTime(7.2).latitude).toBeCloseTo(17.385315, 6);
  });

  it("relativeAltitude interpolates through the gap at t=5.0", () => {
    expect(it_.getAtTime(5.0).relativeAltitude).toBeCloseTo(14.5, 3);
  });
});

describe("in-code cases", () => {
  it("timestamp vectors", () => {
    expect(parseSrtTimestamp("00:00:01,000")).toBe(1);
    expect(parseSrtTimestamp("00:01:10,500")).toBe(70.5);
    expect(parseSrtTimestamp("01:10:00,250")).toBe(4200.25);
    expect(parseSrtTimestamp("00:00:01.5")).toBe(1.5);
    expect(parseSrtTimestamp("00:61:00,000")).toBeNull();
  });

  function mkSeries(times: number[], key: keyof TelemetrySeries, values: number[]): TelemetrySeries {
    const s = {
      length: times.length,
      t: Float64Array.from(times),
      start: Float64Array.from(times.map((x) => x - 0.5)),
      end: Float64Array.from(times.map((x) => x + 0.5)),
    } as TelemetrySeries;
    const allFields: (keyof TelemetrySeries)[] = [
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
    for (const f of allFields) (s as unknown as Record<string, Float64Array>)[f] = new Float64Array(times.length).fill(NaN);
    (s as unknown as Record<string, Float64Array>)[key] = Float64Array.from(values);
    return s;
  }

  it("linear interpolation: 10s=100, 20s=200 → 15s=150", () => {
    const series = mkSeries([10, 20], "relativeAltitude", [100, 200]);
    expect(createInterpolator(series, { maxGapSec: 20 }).getAtTime(15).relativeAltitude).toBeCloseTo(150, 6);
  });

  it("heading 359→1 midpoint wraps to 0", () => {
    const series = mkSeries([0, 1], "heading", [359, 1]);
    expect(createInterpolator(series).getAtTime(0.5).heading).toBeCloseTo(0, 6);
  });

  it("heading 1→359 midpoint wraps to 0", () => {
    const series = mkSeries([0, 1], "heading", [1, 359]);
    expect(createInterpolator(series).getAtTime(0.5).heading).toBeCloseTo(0, 6);
  });

  it("heading 350→10 at f=0.25 → 355", () => {
    const series = mkSeries([0, 1], "heading", [350, 10]);
    expect(createInterpolator(series).getAtTime(0.25).heading).toBeCloseTo(355, 6);
  });

  it("CRLF and UTF-8-BOM variants parse identically", () => {
    const air = fs.readFileSync(path.join(FIXTURES, "dji-air3s-25fps.SRT"), "utf8");
    const crlf = parseTelemetry(air.replace(/\n/g, "\r\n"), { coordinateOrder: "auto" });
    const bom = parseTelemetry(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(air)]), { coordinateOrder: "auto" });
    expect(crlf.report.parsedRecords).toBe(30);
    expect(bom.report.parsedRecords).toBe(30);
    expect(crlf.points[2].latitude).toBeCloseTo(17.385044, 6);
    expect(bom.points[2].latitude).toBeCloseTo(17.385044, 6);
  });

  it("UTF-16LE with BOM parses identically", () => {
    const air = fs.readFileSync(path.join(FIXTURES, "dji-air3s-25fps.SRT"), "utf8");
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(air, "utf16le")]);
    expect(parseTelemetry(new Uint8Array(utf16), { coordinateOrder: "auto" }).report.parsedRecords).toBe(30);
  });

  it("missing index lines still parse", () => {
    const air = fs.readFileSync(path.join(FIXTURES, "dji-air3s-25fps.SRT"), "utf8");
    const noIndex = air
      .split("\n")
      .filter((l) => !/^\d+$/.test(l))
      .join("\n");
    expect(parseTelemetry(noIndex, { coordinateOrder: "auto" }).report.parsedRecords).toBe(30);
  });
});

// Rebuilds a TelemetrySeries from parsed points for direct interpolator checks (mirrors what
// persistence.server.ts does via toSeriesJson/seriesFromJson, without the storage round-trip).
function pointsSeries(r: ReturnType<typeof load>): TelemetrySeries {
  const series = pointsToSeries(r.points);
  series.groundSpeedGps = Float64Array.from(r.derived.groundSpeedGps, (v) => (v === null ? NaN : v));
  series.courseGps = Float64Array.from(r.derived.courseGps, (v) => (v === null ? NaN : v));
  return series;
}
