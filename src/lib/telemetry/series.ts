import type { TelemetryPoint } from "@/types/telemetry";

export interface TelemetrySeries {
  length: number;
  t: Float64Array;
  start: Float64Array;
  end: Float64Array;
  latitude: Float64Array;
  longitude: Float64Array;
  relativeAltitude: Float64Array;
  absoluteAltitude: Float64Array;
  speed: Float64Array;
  speedX: Float64Array;
  speedY: Float64Array;
  speedZ: Float64Array;
  heading: Float64Array;
  aircraftPitch: Float64Array;
  aircraftRoll: Float64Array;
  aircraftYaw: Float64Array;
  gimbalPitch: Float64Array;
  gimbalRoll: Float64Array;
  gimbalYaw: Float64Array;
  recordedAtMs: Float64Array;
  groundSpeedGps: Float64Array;
  courseGps: Float64Array;
}

/** "YYYY-MM-DD HH:MM:SS.mmm" (naive wall clock, no timezone) → Date.UTC(...) milliseconds. */
export function recordedAtToMs(recordedAt: string | null): number | null {
  if (recordedAt === null) return null;
  const ms = Date.parse(`${recordedAt.replace(" ", "T")}Z`);
  return Number.isFinite(ms) ? ms : null;
}

function col(points: TelemetryPoint[], f: (p: TelemetryPoint) => number | null): Float64Array {
  return Float64Array.from(points, (p) => {
    const v = f(p);
    return v === null ? NaN : v;
  });
}

/** Builds the columnar series used by the interpolator; groundSpeedGps/courseGps start as NaN until derive.ts fills them in. */
export function pointsToSeries(points: TelemetryPoint[]): TelemetrySeries {
  return {
    length: points.length,
    t: col(points, (p) => p.timestamp),
    start: col(points, (p) => p.startTime),
    end: col(points, (p) => p.endTime),
    latitude: col(points, (p) => p.latitude),
    longitude: col(points, (p) => p.longitude),
    relativeAltitude: col(points, (p) => p.relativeAltitude),
    absoluteAltitude: col(points, (p) => p.absoluteAltitude),
    speed: col(points, (p) => p.speed),
    speedX: col(points, (p) => p.speedX),
    speedY: col(points, (p) => p.speedY),
    speedZ: col(points, (p) => p.speedZ),
    heading: col(points, (p) => p.heading),
    aircraftPitch: col(points, (p) => p.aircraftPitch),
    aircraftRoll: col(points, (p) => p.aircraftRoll),
    aircraftYaw: col(points, (p) => p.aircraftYaw),
    gimbalPitch: col(points, (p) => p.gimbalPitch),
    gimbalRoll: col(points, (p) => p.gimbalRoll),
    gimbalYaw: col(points, (p) => p.gimbalYaw),
    recordedAtMs: col(points, (p) => recordedAtToMs(p.recordedAt)),
    groundSpeedGps: new Float64Array(points.length).fill(NaN),
    courseGps: new Float64Array(points.length).fill(NaN),
  };
}

export interface TelemetrySeriesJson {
  t: number[];
  start: number[];
  end: number[];
  latitude: (number | null)[];
  longitude: (number | null)[];
  relativeAltitude: (number | null)[];
  absoluteAltitude: (number | null)[];
  speed: (number | null)[];
  speedX: (number | null)[];
  speedY: (number | null)[];
  speedZ: (number | null)[];
  heading: (number | null)[];
  aircraftPitch: (number | null)[];
  aircraftRoll: (number | null)[];
  aircraftYaw: (number | null)[];
  gimbalPitch: (number | null)[];
  gimbalRoll: (number | null)[];
  gimbalYaw: (number | null)[];
  groundSpeedGps: (number | null)[];
  courseGps: (number | null)[];
  recordedAtMs: (number | null)[];
  frameIndex: (number | null)[];
}

function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

function roundOrNull(v: number | null, decimals: number): number | null {
  return v === null ? null : round(v, decimals);
}

/** Rounding on write: lat/lon to 7 decimals, times to 6, everything else to 3. */
export function toSeriesJson(points: TelemetryPoint[], derived: { groundSpeedGps: (number | null)[]; courseGps: (number | null)[] }): TelemetrySeriesJson {
  return {
    t: points.map((p) => round(p.timestamp, 6)),
    start: points.map((p) => round(p.startTime, 6)),
    end: points.map((p) => round(p.endTime, 6)),
    latitude: points.map((p) => roundOrNull(p.latitude, 7)),
    longitude: points.map((p) => roundOrNull(p.longitude, 7)),
    relativeAltitude: points.map((p) => roundOrNull(p.relativeAltitude, 3)),
    absoluteAltitude: points.map((p) => roundOrNull(p.absoluteAltitude, 3)),
    speed: points.map((p) => roundOrNull(p.speed, 3)),
    speedX: points.map((p) => roundOrNull(p.speedX, 3)),
    speedY: points.map((p) => roundOrNull(p.speedY, 3)),
    speedZ: points.map((p) => roundOrNull(p.speedZ, 3)),
    heading: points.map((p) => roundOrNull(p.heading, 3)),
    aircraftPitch: points.map((p) => roundOrNull(p.aircraftPitch, 3)),
    aircraftRoll: points.map((p) => roundOrNull(p.aircraftRoll, 3)),
    aircraftYaw: points.map((p) => roundOrNull(p.aircraftYaw, 3)),
    gimbalPitch: points.map((p) => roundOrNull(p.gimbalPitch, 3)),
    gimbalRoll: points.map((p) => roundOrNull(p.gimbalRoll, 3)),
    gimbalYaw: points.map((p) => roundOrNull(p.gimbalYaw, 3)),
    groundSpeedGps: derived.groundSpeedGps.map((v) => roundOrNull(v, 3)),
    courseGps: derived.courseGps.map((v) => roundOrNull(v, 3)),
    recordedAtMs: points.map((p) => {
      const ms = recordedAtToMs(p.recordedAt);
      return ms === null ? null : Math.round(ms);
    }),
    frameIndex: points.map((p) => p.frameIndex),
  };
}

function fromCol(values: (number | null)[]): Float64Array {
  return Float64Array.from(values, (v) => (v === null ? NaN : v));
}

export function seriesFromJson(json: TelemetrySeriesJson): TelemetrySeries {
  return {
    length: json.t.length,
    t: Float64Array.from(json.t),
    start: Float64Array.from(json.start),
    end: Float64Array.from(json.end),
    latitude: fromCol(json.latitude),
    longitude: fromCol(json.longitude),
    relativeAltitude: fromCol(json.relativeAltitude),
    absoluteAltitude: fromCol(json.absoluteAltitude),
    speed: fromCol(json.speed),
    speedX: fromCol(json.speedX),
    speedY: fromCol(json.speedY),
    speedZ: fromCol(json.speedZ),
    heading: fromCol(json.heading),
    aircraftPitch: fromCol(json.aircraftPitch),
    aircraftRoll: fromCol(json.aircraftRoll),
    aircraftYaw: fromCol(json.aircraftYaw),
    gimbalPitch: fromCol(json.gimbalPitch),
    gimbalRoll: fromCol(json.gimbalRoll),
    gimbalYaw: fromCol(json.gimbalYaw),
    recordedAtMs: fromCol(json.recordedAtMs),
    groundSpeedGps: fromCol(json.groundSpeedGps),
    courseGps: fromCol(json.courseGps),
  };
}
