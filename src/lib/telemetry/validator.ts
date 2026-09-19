import { mapKey, normalizeKey, toSi, type MappedTarget } from "./fields";
import { haversineMeters } from "./geo";
import { normalize180, normalize360 } from "./normalizer";
import { parseTelemetryNumber } from "./numbers";
import type { ExtractedField } from "./strategies/types";
import type { IssueCode, ParseIssue, TelemetryNumericField } from "@/types/telemetry";

const ISSUE_MESSAGES: Record<IssueCode, string> = {
  BAD_TIMESTAMP: "Cue timing could not be parsed.",
  END_BEFORE_START: "Cue end time is before its start time.",
  EMPTY_PAYLOAD: "Cue has no payload text.",
  NO_FIELDS: "No recognized telemetry fields in this cue.",
  OUT_OF_ORDER: "Cues were out of chronological order and were sorted by time.",
  DUPLICATE_TIME: "Duplicate timestamp; a later cue with the same time was dropped.",
  DUPLICATE_KEY: "Duplicate field in this cue; the first occurrence was kept.",
  GPS_NO_FIX: "GPS position is (0, 0), treated as no fix.",
  GPS_OUT_OF_RANGE: "GPS coordinates are outside the valid range.",
  GPS_PARTIAL: "Only one of latitude/longitude was present.",
  GPS_SPIKE: "GPS position looked like a spike and was discarded.",
  VALUE_OUT_OF_RANGE: "Value is outside the plausible range.",
  GPS_TUPLE_ORDER_ASSUMED: "GPS tuple coordinate order could not be detected; longitude, latitude was assumed.",
  ENCODING_REPLACED_CHARS: "Some characters could not be decoded and were replaced.",
};

function makeIssue(code: IssueCode, cueOrdinal: number | null, field?: TelemetryNumericField): ParseIssue {
  return { code, cueOrdinal, line: null, field, message: ISSUE_MESSAGES[code] };
}

export interface ValidatedFields {
  latitude: number | null;
  longitude: number | null;
  relativeAltitude: number | null;
  absoluteAltitude: number | null;
  speedX: number | null;
  speedY: number | null;
  speedZ: number | null;
  speed: number | null;
  heading: number | null;
  aircraftPitch: number | null;
  aircraftRoll: number | null;
  aircraftYaw: number | null;
  gimbalPitch: number | null;
  gimbalRoll: number | null;
  gimbalYaw: number | null;
  speedFromComponents: boolean;
}

export interface ValidatedRecord {
  fields: ValidatedFields;
  mappedCount: number;
  unknownKeys: string[];
  issues: ParseIssue[];
}

/** Maps raw extracted fields to SI values then range-validates them into TelemetryPoint fields. */
export function validateRecord(extracted: ExtractedField[], cueOrdinal: number): ValidatedRecord {
  const issues: ParseIssue[] = [];
  const unknownKeys: string[] = [];
  const values: Partial<Record<MappedTarget, number | null>> = {};
  const present = new Set<MappedTarget>();
  let mappedCount = 0;
  let speedKeyPresent = false;

  for (const { key, raw } of extracted) {
    const target = mapKey(normalizeKey(key));
    if (!target) {
      unknownKeys.push(key.toLowerCase());
      continue;
    }
    if (target === "frameIndex") continue;
    mappedCount++;
    if (present.has(target)) {
      issues.push(makeIssue("DUPLICATE_KEY", cueOrdinal, target));
      continue;
    }
    present.add(target);
    const parsed = parseTelemetryNumber(raw);
    values[target] = parsed ? toSi(target, parsed) : null;
    if (target === "speed" && parsed) speedKeyPresent = true;
  }

  const fields: ValidatedFields = {
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
    speedFromComponents: false,
  };

  const lat = values.latitude ?? null;
  const lon = values.longitude ?? null;
  if (present.has("latitude") || present.has("longitude")) {
    if (lat === null || lon === null) issues.push(makeIssue("GPS_PARTIAL", cueOrdinal));
    else if (Math.abs(lat) > 90 || Math.abs(lon) > 180) issues.push(makeIssue("GPS_OUT_OF_RANGE", cueOrdinal));
    else if (Math.abs(lat) < 1e-6 && Math.abs(lon) < 1e-6) issues.push(makeIssue("GPS_NO_FIX", cueOrdinal));
    else {
      fields.latitude = lat;
      fields.longitude = lon;
    }
  }

  for (const f of ["relativeAltitude", "absoluteAltitude"] as const) {
    const v = values[f];
    if (v === undefined || v === null) continue;
    if (v >= -1000 && v <= 12000) fields[f] = v;
    else issues.push(makeIssue("VALUE_OUT_OF_RANGE", cueOrdinal, f));
  }

  if (values.speed != null) {
    if (values.speed >= 0 && values.speed <= 150) fields.speed = values.speed;
    else issues.push(makeIssue("VALUE_OUT_OF_RANGE", cueOrdinal, "speed"));
  }
  for (const f of ["speedX", "speedY", "speedZ"] as const) {
    const v = values[f];
    if (v == null) continue;
    if (Math.abs(v) <= 150) fields[f] = v;
    else issues.push(makeIssue("VALUE_OUT_OF_RANGE", cueOrdinal, f));
  }
  // Horizontal-only, never 3D.
  if (fields.speed === null && !speedKeyPresent && fields.speedX !== null && fields.speedY !== null) {
    fields.speed = Math.hypot(fields.speedX, fields.speedY);
    fields.speedFromComponents = true;
  }

  if (values.aircraftYaw != null && Math.abs(values.aircraftYaw) <= 720) fields.aircraftYaw = normalize180(values.aircraftYaw);
  if (values.gimbalYaw != null && Math.abs(values.gimbalYaw) <= 720) fields.gimbalYaw = normalize180(values.gimbalYaw);
  for (const f of ["aircraftPitch", "aircraftRoll", "gimbalPitch", "gimbalRoll"] as const) {
    const v = values[f];
    if (v != null && Math.abs(v) <= 180) fields[f] = v;
  }

  // Gimbal yaw never becomes heading.
  if (values.heading != null && Math.abs(values.heading) <= 720) fields.heading = normalize360(values.heading);
  else if (values.aircraftYaw != null && Math.abs(values.aircraftYaw) <= 720) fields.heading = normalize360(values.aircraftYaw);

  return { fields, mappedCount, unknownKeys, issues };
}

/**
 * File-level, single pass after sorting. Nulls the GPS of an isolated spike point in place and returns
 * its issue. `points` must already be sorted by startTime.
 */
export function filterGpsSpikes<T extends { latitude: number | null; longitude: number | null; timestamp: number; cueOrdinal: number }>(
  points: T[],
): ParseIssue[] {
  const MAX_PLAUSIBLE_SPEED_MPS = 60;
  const gpsIdx: number[] = [];
  points.forEach((p, i) => {
    if (p.latitude !== null) gpsIdx.push(i);
  });

  const spikes: number[] = [];
  for (let j = 1; j < gpsIdx.length - 1; j++) {
    const a = points[gpsIdx[j - 1]];
    const i = points[gpsIdx[j]];
    const b = points[gpsIdx[j + 1]];
    const dt1 = i.timestamp - a.timestamp;
    const dt2 = b.timestamp - i.timestamp;
    if (dt1 <= 0 || dt2 <= 0 || dt1 > 5 || dt2 > 5) continue;
    const v1 = haversineDistance(a, i) / dt1;
    const v2 = haversineDistance(i, b) / dt2;
    const v3 = haversineDistance(a, b) / (dt1 + dt2);
    if (v1 > MAX_PLAUSIBLE_SPEED_MPS && v2 > MAX_PLAUSIBLE_SPEED_MPS && v3 <= MAX_PLAUSIBLE_SPEED_MPS) spikes.push(gpsIdx[j]);
  }

  const issues: ParseIssue[] = [];
  for (const k of spikes) {
    points[k].latitude = null;
    points[k].longitude = null;
    issues.push(makeIssue("GPS_SPIKE", points[k].cueOrdinal));
  }
  return issues;
}

function haversineDistance(a: { latitude: number | null; longitude: number | null }, b: { latitude: number | null; longitude: number | null }): number {
  // filterGpsSpikes only calls this for points already known to have valid GPS (gpsIdx filter).
  return haversineMeters(a.latitude as number, a.longitude as number, b.latitude as number, b.longitude as number);
}
