import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadLocalFlight, nearestTimeTo, pairFiles } from "@/lib/viewer/local-flight";

const fixture = (name: string) => new Uint8Array(readFileSync(`tests/fixtures/srt/${name}`));
const f = (name: string) => ({ name });

describe("pairFiles", () => {
  it("pairs by base name, keeps SRT-only and video-only flights, sorted", () => {
    const pairs = pairFiles([f("DJI_0042.MP4"), f("DJI_0041.srt"), f("DJI_0041.MP4"), f("DJI_0042.SRT"), f("DJI_0043.SRT"), f("clip.mov")]);
    expect(pairs.map((p) => [p.key, p.video?.name ?? null, p.srt?.name ?? null])).toEqual([
      ["clip", "clip.mov", null],
      ["dji_0041", "DJI_0041.MP4", "DJI_0041.srt"],
      ["dji_0042", "DJI_0042.MP4", "DJI_0042.SRT"],
      ["dji_0043", null, "DJI_0043.SRT"],
    ]);
  });

  it("applies manual overrides and releases the displaced SRT", () => {
    const files = [f("A.MP4"), f("A.SRT"), f("B.SRT")];
    expect(pairFiles(files, { "A.MP4": "B.SRT" }).map((p) => [p.video?.name ?? null, p.srt?.name])).toEqual([
      ["A.MP4", "B.SRT"],
      [null, "A.SRT"],
    ]);
    expect(pairFiles(files, { "A.MP4": null })[0].srt).toBeNull();
  });
});

describe("loadLocalFlight", () => {
  it("modern bracket format: path, stats, camera", () => {
    const flight = loadLocalFlight(fixture("dji-air3s-25fps.SRT"));
    expect(flight.flightPath?.features.map((x) => x.properties.kind)).toEqual(["path", "start", "end"]);
    expect(flight.stats.gpsPoints).toBe(Math.round(flight.summary.gpsCoverage * flight.summary.sampleCount));
    expect(flight.stats.gpsPoints).toBeLessThan(flight.points.length); // fixture has samples without a fix
    expect(flight.stats.distanceMeters).toBeGreaterThan(0);
    expect(flight.stats.durationSec).toBeGreaterThan(0);
    expect(flight.camera[0]).toMatchObject({ iso: "200", shutter: "1/6400", aperture: "f/1.8", focalLength: "24 mm" });
  });

  it("legacy GPS(...) format parses and scales old camera units", () => {
    expect(loadLocalFlight(fixture("dji-phantom3-legacy.SRT")).flightPath).not.toBeNull();
    expect(loadLocalFlight(fixture("dji-mavic3-srtcnt.SRT")).camera[0]).toMatchObject({ aperture: "f/2.8", focalLength: "24 mm" });
  });

  it("telemetry without GPS gives a message, not a map", () => {
    const flight = loadLocalFlight(fixture("missing-gps.SRT"));
    expect(flight.flightPath).toBeNull();
    expect(flight.noGpsMessage).toMatch(/no usable GPS/);
    expect(flight.stats.distanceMeters).toBeNull();
  });

  it("unreadable files throw a friendly error", () => {
    expect(() => loadLocalFlight(fixture("not-telemetry.SRT"))).toThrow("Unable to read this SRT file.");
    expect(() => loadLocalFlight("")).toThrow("Unable to read this SRT file.");
  });

  it("nearestTimeTo returns the closest GPS sample time", () => {
    const flight = loadLocalFlight(fixture("dji-air3s-25fps.SRT"));
    const target = flight.points[10];
    const hit = flight.points.find((p) => p.timestamp === nearestTimeTo(flight.points, target.latitude! + 1e-7, target.longitude!))!;
    expect([hit.latitude, hit.longitude]).toEqual([target.latitude, target.longitude]);
  });
});
