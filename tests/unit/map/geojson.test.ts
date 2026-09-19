import { describe, expect, it } from "vitest";
import { z } from "zod";
import { boundsOf, buildFlightPathGeoJson, extractGpsTrack, pathLengthMeters, splitPathAtTime, toLonLat, type GpsTrack } from "@/lib/map/geojson";
import type { TelemetryPoint } from "@/types/telemetry";

const lonLatSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const flightPathGeoJsonSchema = z.object({
  type: z.literal("FeatureCollection"),
  bbox: z.union([z.tuple([z.number(), z.number(), z.number(), z.number()]), z.null()]),
  features: z.array(
    z.union([
      z.object({
        type: z.literal("Feature"),
        properties: z.object({
          kind: z.literal("path"),
          times: z.array(z.number()),
          sampleIndices: z.array(z.number().int()),
          toleranceMeters: z.number(),
          sourcePointCount: z.number().int(),
          lengthMeters: z.number(),
        }),
        geometry: z.object({ type: z.literal("LineString"), coordinates: z.array(lonLatSchema).min(2) }),
      }),
      z.object({
        type: z.literal("Feature"),
        properties: z.object({ kind: z.enum(["start", "end"]), time: z.number() }),
        geometry: z.object({ type: z.literal("Point"), coordinates: lonLatSchema }),
      }),
    ]),
  ),
});

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

describe("toLonLat", () => {
  it("always orders [longitude, latitude]", () => {
    expect(toLonLat({ latitude: 17.385044, longitude: 78.486671 })).toEqual([78.486671, 17.385044]);
  });
});

describe("extractGpsTrack", () => {
  it("drops points without GPS and collapses consecutive duplicate positions", () => {
    const points = [
      makePoint({ latitude: null, longitude: null, timestamp: 0 }),
      makePoint({ latitude: 1, longitude: 1, timestamp: 1 }),
      makePoint({ latitude: 1, longitude: 1, timestamp: 2 }), // duplicate of the previous position
      makePoint({ latitude: 2, longitude: 2, timestamp: 3 }),
    ];
    const track = extractGpsTrack(points);
    expect(track.coords).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(track.times).toEqual([1, 3]);
    expect(track.sampleIndices).toEqual([1, 3]);
  });

  it("returns an empty track when there is no GPS at all", () => {
    const track = extractGpsTrack([makePoint({}), makePoint({})]);
    expect(track.coords).toEqual([]);
  });
});

describe("pathLengthMeters", () => {
  it("sums haversine distance over consecutive coordinates", () => {
    const coords: [number, number][] = [
      [78.486671, 17.385044],
      [78.486736, 17.385109],
    ];
    const length = pathLengthMeters(coords);
    expect(length).toBeGreaterThan(0);
    expect(length).toBeLessThan(50);
  });

  it("is zero for a single point or an empty track", () => {
    expect(pathLengthMeters([[0, 0]])).toBe(0);
    expect(pathLengthMeters([])).toBe(0);
  });
});

it("lat/lon → GeoJSON [lon, lat]", () => {
  expect(toLonLat({ latitude: 17.385044, longitude: 78.486671 })).toEqual([78.486671, 17.385044]);
});

describe("boundsOf", () => {
  it("computes min/max over lon and lat independently", () => {
    const bounds = boundsOf([
      [78.486671, 17.385044],
      [78.486736, 17.385109],
      [78.486600, 17.385000],
    ]);
    expect(bounds).toEqual({ minLon: 78.4866, minLat: 17.385, maxLon: 78.486736, maxLat: 17.385109 });
  });

  it("returns null for an empty track", () => {
    expect(boundsOf([])).toBeNull();
  });
});

describe("buildFlightPathGeoJson", () => {
  const track: GpsTrack = {
    coords: [
      [78.486671, 17.385044],
      [78.486736, 17.385109],
    ],
    times: [0.1, 1.18],
    sampleIndices: [2, 29],
  };

  it("has a path LineString feature plus start/end Point features", () => {
    const fc = buildFlightPathGeoJson(track, { simplify: false });
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(3);
    const kinds = fc.features.map((f) => f.properties.kind);
    expect(kinds).toEqual(["path", "start", "end"]);

    const path = fc.features[0];
    expect(path.geometry.type).toBe("LineString");
    expect(path.geometry.coordinates).toEqual(track.coords);
    if (path.properties.kind === "path") {
      expect(path.properties.sourcePointCount).toBe(2);
      expect(path.properties.times).toEqual(track.times);
      expect(path.properties.sampleIndices).toEqual(track.sampleIndices);
    }

    const start = fc.features[1];
    expect(start.geometry).toEqual({ type: "Point", coordinates: track.coords[0] });
    const end = fc.features[2];
    expect(end.geometry).toEqual({ type: "Point", coordinates: track.coords[1] });
  });

  it("computes a bbox that matches the output coordinates", () => {
    const fc = buildFlightPathGeoJson(track, { simplify: false });
    expect(fc.bbox).toEqual([78.486671, 17.385044, 78.486736, 17.385109]);
  });

  it("duplicates a single-point track into a valid 2-vertex LineString", () => {
    const single: GpsTrack = { coords: [[78.486671, 17.385044]], times: [0.5], sampleIndices: [0] };
    const fc = buildFlightPathGeoJson(single, { simplify: false });
    const path = fc.features[0];
    expect(path.geometry.coordinates).toEqual([
      [78.486671, 17.385044],
      [78.486671, 17.385044],
    ]);
  });

  it("returns an empty FeatureCollection for an empty track", () => {
    const fc = buildFlightPathGeoJson({ coords: [], times: [], sampleIndices: [] }, { simplify: false });
    expect(fc.features).toEqual([]);
    expect(fc.bbox).toBeNull();
  });

  it("produces structurally valid GeoJSON (zod schema, in lieu of a geojson.io network check)", () => {
    const simplified = buildFlightPathGeoJson(track, { simplify: true });
    const full = buildFlightPathGeoJson(track, { simplify: false });
    expect(() => flightPathGeoJsonSchema.parse(simplified)).not.toThrow();
    expect(() => flightPathGeoJsonSchema.parse(full)).not.toThrow();
  });

  it("simplify:true reduces vertex count for a long redundant straight line", () => {
    const n = 200;
    const coords: [number, number][] = Array.from({ length: n }, (_, i) => [78.4 + i * 0.0001, 17.3]);
    const straightTrack: GpsTrack = { coords, times: coords.map((_, i) => i), sampleIndices: coords.map((_, i) => i) };
    const fc = buildFlightPathGeoJson(straightTrack, { simplify: true });
    expect(fc.features[0].geometry.coordinates.length).toBeLessThan(n);
    expect(fc.features[0].geometry.coordinates.length).toBeGreaterThanOrEqual(2);
  });
});

describe("splitPathAtTime", () => {
  const track: GpsTrack = {
    coords: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    times: [0, 1, 2, 3],
    sampleIndices: [0, 1, 2, 3],
  };
  const fc = buildFlightPathGeoJson(track, { simplify: false });

  it("splits vertices at time <= t into flown, the rest into remaining", () => {
    const { flown, remaining } = splitPathAtTime(fc, 1.5, null);
    expect(flown).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(remaining).toEqual([
      [2, 0],
      [3, 0],
    ]);
  });

  it("appends current to flown and prepends it to remaining", () => {
    const current: [number, number] = [1.5, 0];
    const { flown, remaining } = splitPathAtTime(fc, 1.5, current);
    expect(flown.at(-1)).toEqual(current);
    expect(remaining[0]).toEqual(current);
  });
});
