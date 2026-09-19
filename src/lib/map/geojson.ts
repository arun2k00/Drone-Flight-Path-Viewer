import { haversineMeters } from "@/lib/telemetry/geo";
import type { GeoBounds, TelemetryPoint } from "@/types/telemetry";
import { simplifyTrack } from "./simplify";

/** GeoJSON position order: ALWAYS [longitude, latitude]. */
export type LonLat = readonly [longitude: number, latitude: number];

/** The only constructor — named arguments prevent swapping lat/lon. */
export function toLonLat(p: { latitude: number; longitude: number }): LonLat {
  return [p.longitude, p.latitude];
}

export interface GpsTrack {
  coords: LonLat[];
  times: number[];
  sampleIndices: number[];
}

type GpsPoint = Pick<TelemetryPoint, "latitude" | "longitude" | "timestamp">;

/**
 * Points with valid GPS, in time order, with consecutive duplicate positions dropped (keeping the
 * first time). This is the raw, unsimplified track — simplify.ts handles visual simplification.
 */
export function extractGpsTrack(points: GpsPoint[]): GpsTrack {
  const coords: LonLat[] = [];
  const times: number[] = [];
  const sampleIndices: number[] = [];

  points.forEach((p, i) => {
    if (p.latitude === null || p.longitude === null) return;
    const prevIndex = coords.length - 1;
    if (prevIndex >= 0) {
      const [prevLon, prevLat] = coords[prevIndex];
      if (prevLat === p.latitude && prevLon === p.longitude) return;
    }
    coords.push(toLonLat({ latitude: p.latitude, longitude: p.longitude }));
    times.push(p.timestamp);
    sampleIndices.push(i);
  });

  return { coords, times, sampleIndices };
}

/** Sum of haversine distances over consecutive coordinates. */
export function pathLengthMeters(coords: LonLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lonA, latA] = coords[i - 1];
    const [lonB, latB] = coords[i];
    total += haversineMeters(latA, lonA, latB, lonB);
  }
  return total;
}

export function boundsOf(coords: LonLat[]): GeoBounds | null {
  if (coords.length === 0) return null;
  let minLon = coords[0][0];
  let maxLon = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, minLat, maxLon, maxLat };
}

export type FlightPathFeature =
  | {
      type: "Feature";
      properties: {
        kind: "path";
        times: number[];
        sampleIndices: number[];
        toleranceMeters: number;
        sourcePointCount: number;
        lengthMeters: number;
      };
      geometry: { type: "LineString"; coordinates: LonLat[] };
    }
  | {
      type: "Feature";
      properties: { kind: "start" | "end"; time: number };
      geometry: { type: "Point"; coordinates: LonLat };
    };

export interface FlightPathGeoJson {
  type: "FeatureCollection";
  bbox: [number, number, number, number] | null;
  features: FlightPathFeature[];
}

/** `simplify: false` produces the full-resolution track (tolerance 0), used by the /download route. */
export function buildFlightPathGeoJson(track: GpsTrack, opts: { simplify: boolean }): FlightPathGeoJson {
  if (track.coords.length === 0) {
    return { type: "FeatureCollection", bbox: null, features: [] };
  }

  let coords: LonLat[];
  let times: number[];
  let sampleIndices: number[];
  let toleranceMeters: number;

  if (track.coords.length === 1) {
    // GeoJSON LineString requires >= 2 positions.
    coords = [track.coords[0], track.coords[0]];
    times = [track.times[0], track.times[0]];
    sampleIndices = [track.sampleIndices[0], track.sampleIndices[0]];
    toleranceMeters = 0;
  } else if (opts.simplify) {
    const result = simplifyTrack(track.coords);
    coords = result.indices.map((i) => track.coords[i]);
    times = result.indices.map((i) => track.times[i]);
    sampleIndices = result.indices.map((i) => track.sampleIndices[i]);
    toleranceMeters = result.toleranceMeters;
  } else {
    coords = track.coords;
    times = track.times;
    sampleIndices = track.sampleIndices;
    toleranceMeters = 0;
  }

  const pathFeature: FlightPathFeature = {
    type: "Feature",
    properties: {
      kind: "path",
      times,
      sampleIndices,
      toleranceMeters,
      sourcePointCount: track.coords.length,
      lengthMeters: pathLengthMeters(coords),
    },
    geometry: { type: "LineString", coordinates: coords },
  };
  const startFeature: FlightPathFeature = {
    type: "Feature",
    properties: { kind: "start", time: track.times[0] },
    geometry: { type: "Point", coordinates: track.coords[0] },
  };
  const endFeature: FlightPathFeature = {
    type: "Feature",
    properties: { kind: "end", time: track.times[track.times.length - 1] },
    geometry: { type: "Point", coordinates: track.coords[track.coords.length - 1] },
  };

  const bounds = boundsOf(coords);
  return {
    type: "FeatureCollection",
    bbox: bounds ? [bounds.minLon, bounds.minLat, bounds.maxLon, bounds.maxLat] : null,
    features: [pathFeature, startFeature, endFeature],
  };
}

/** Binary search on `times`; vertices with time ≤ t go to `flown`, then `current` (if any) joins both sides. */
export function splitPathAtTime(path: FlightPathGeoJson, t: number, current: LonLat | null): { flown: LonLat[]; remaining: LonLat[] } {
  const pathFeature = path.features.find((f): f is Extract<FlightPathFeature, { properties: { kind: "path" } }> => f.properties.kind === "path");
  if (!pathFeature) return { flown: [], remaining: [] };

  const { times } = pathFeature.properties;
  const coords = pathFeature.geometry.coordinates;

  let lo = 0;
  let hi = times.length - 1;
  let k = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) {
      k = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const flown = coords.slice(0, k + 1);
  const remaining = coords.slice(k + 1);
  if (current) {
    flown.push(current);
    remaining.unshift(current);
  }
  return { flown, remaining };
}
