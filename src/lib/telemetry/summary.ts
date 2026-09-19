import { formatCatalogMessage } from "@/lib/errors/codes";
import type { WarningDto } from "@/types/api";
import type { GeoBounds, ParseReport, TelemetryCapabilities, TelemetryPoint, TelemetrySummary } from "@/types/telemetry";
import type { DerivedGpsSeries } from "./derive";

function median(sortedDeltas: number[]): number | null {
  if (sortedDeltas.length === 0) return null;
  const mid = Math.floor((sortedDeltas.length - 1) / 2);
  return sortedDeltas.length % 2 ? sortedDeltas[mid] : (sortedDeltas[mid] + sortedDeltas[mid + 1]) / 2;
}

function buildWarnings(
  capabilities: TelemetryCapabilities,
  gpsCoverage: number,
  report: ParseReport,
  speedCapability: TelemetryCapabilities["speed"],
): WarningDto[] {
  const warnings: WarningDto[] = [];
  if (!capabilities.gps) warnings.push({ code: "TELEMETRY_NO_GPS", message: formatCatalogMessage("TELEMETRY_NO_GPS") });
  if (gpsCoverage > 0 && gpsCoverage < 0.95) {
    warnings.push({ code: "GPS_INCOMPLETE", message: formatCatalogMessage("GPS_INCOMPLETE", { pct: Math.round(gpsCoverage * 100) }) });
  }
  if (report.issueCounts.GPS_TUPLE_ORDER_ASSUMED) {
    warnings.push({ code: "GPS_TUPLE_ORDER_ASSUMED", message: formatCatalogMessage("GPS_TUPLE_ORDER_ASSUMED") });
  }
  if (speedCapability === "gps-derived") warnings.push({ code: "SPEED_DERIVED_FROM_GPS", message: formatCatalogMessage("SPEED_DERIVED_FROM_GPS") });
  if (capabilities.heading === "none") warnings.push({ code: "HEADING_UNAVAILABLE", message: formatCatalogMessage("HEADING_UNAVAILABLE") });
  return warnings;
}

function numericRange(values: number[]): { min: number; max: number } | null {
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** pathLengthMeters is filled in by the caller from the simplified flight path. */
export function buildSummary(
  points: TelemetryPoint[],
  speedFromComponents: boolean[], // parallel to points — true where speed was synthesized from vx/vy
  derived: DerivedGpsSeries,
  report: ParseReport,
  timeRange: { start: number; end: number },
  pathLengthMeters: number | null,
): TelemetrySummary {
  const n = points.length;
  const gpsCount = points.filter((p) => p.latitude !== null).length;
  const deltas = points
    .slice(1)
    .map((p, i) => p.timestamp - points[i].timestamp)
    .sort((a, b) => a - b);
  const medianIntervalSec = median(deltas);

  const anySrtSpeed = points.some((p, i) => p.speed !== null && !speedFromComponents[i]);
  const anyComponentSpeed = points.some((p, i) => p.speed !== null && speedFromComponents[i]);
  const anyDerivedSpeed = derived.groundSpeedGps.some((v) => v !== null);
  const speed: TelemetryCapabilities["speed"] = anySrtSpeed ? "srt" : anyComponentSpeed ? "srt-components" : anyDerivedSpeed ? "gps-derived" : "none";

  const capabilities: TelemetryCapabilities = {
    gps: gpsCount >= 2,
    relativeAltitude: points.some((p) => p.relativeAltitude !== null),
    absoluteAltitude: points.some((p) => p.absoluteAltitude !== null),
    speed,
    heading: points.some((p) => p.heading !== null) ? "srt" : "none",
    course: derived.courseGps.some((v) => v !== null),
    attitude: points.some((p) => p.aircraftPitch !== null || p.aircraftRoll !== null || p.aircraftYaw !== null),
    gimbal: points.some((p) => p.gimbalPitch !== null || p.gimbalRoll !== null || p.gimbalYaw !== null),
    recordedAt: points.some((p) => p.recordedAt !== null),
  };

  const gpsCoverage = n ? gpsCount / n : 0;
  const withGps = points.filter((p) => p.latitude !== null && p.longitude !== null);
  const bounds: GeoBounds | null = withGps.length
    ? {
        minLat: Math.min(...withGps.map((p) => p.latitude as number)),
        maxLat: Math.max(...withGps.map((p) => p.latitude as number)),
        minLon: Math.min(...withGps.map((p) => p.longitude as number)),
        maxLon: Math.max(...withGps.map((p) => p.longitude as number)),
      }
    : null;

  const firstWithGps = withGps[0];
  const lastWithGps = withGps[withGps.length - 1];
  const firstRecordedAt = points.find((p) => p.recordedAt !== null)?.recordedAt ?? null;
  let lastRecordedAt: string | null = null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].recordedAt !== null) {
      lastRecordedAt = points[i].recordedAt;
      break;
    }
  }

  const autoSpeeds = points.map((p, i) => p.speed ?? derived.groundSpeedGps[i]).filter((v): v is number => v !== null && v !== undefined);

  return {
    parserId: report.parserId,
    parserVersion: report.parserVersion,
    sampleCount: n,
    timeRange,
    medianIntervalSec,
    estimatedRateHz: medianIntervalSec ? 1 / medianIntervalSec : null,
    capabilities,
    gpsCoverage,
    firstFix: firstWithGps
      ? { latitude: firstWithGps.latitude as number, longitude: firstWithGps.longitude as number, time: firstWithGps.timestamp }
      : null,
    lastFix: lastWithGps
      ? { latitude: lastWithGps.latitude as number, longitude: lastWithGps.longitude as number, time: lastWithGps.timestamp }
      : null,
    bounds,
    relativeAltitudeRange: numericRange(points.map((p) => p.relativeAltitude).filter((v): v is number => v !== null)),
    absoluteAltitudeRange: numericRange(points.map((p) => p.absoluteAltitude).filter((v): v is number => v !== null)),
    maxSpeedMps: autoSpeeds.length ? Math.max(...autoSpeeds) : null,
    pathLengthMeters,
    recordedAtStart: firstRecordedAt,
    recordedAtEnd: lastRecordedAt,
    warnings: buildWarnings(capabilities, gpsCoverage, report, speed),
    report,
  };
}
