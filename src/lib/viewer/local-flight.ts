import { AppError } from "@/lib/errors/app-error";
import { buildFlightPathGeoJson, extractGpsTrack, pathLengthMeters, type FlightPathGeoJson } from "@/lib/map/geojson";
import { haversineMeters } from "@/lib/telemetry/geo";
import { createInterpolator, type TelemetryInterpolator } from "@/lib/telemetry/interpolator";
import { parseTelemetry } from "@/lib/telemetry/parser";
import { buildProfile, type TelemetryProfile } from "@/lib/telemetry/profile";
import { seriesFromJson, toSeriesJson } from "@/lib/telemetry/series";
import type { TelemetryPoint, TelemetrySummary } from "@/types/telemetry";

/** Browser-only flight viewer: the SRT is parsed in memory, nothing is uploaded. */

export interface FlightFile {
  name: string;
}

export interface FlightPair<F extends FlightFile = File> {
  key: string; // lower-cased base name of whichever file anchors the pair
  video: F | null;
  srt: F | null;
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, "").toLowerCase();
const ext = (name: string) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();
export const isSrt = (f: FlightFile) => ext(f.name) === "srt";
export const isVideo = (f: FlightFile) => ["mp4", "mov", "m4v"].includes(ext(f.name));

/**
 * Groups videos with SRTs by base name (DJI_0042.MP4 ↔ DJI_0042.SRT, case-insensitive).
 * `overrides` maps a video name to an SRT name (or null for "no SRT") to correct pairing by hand.
 */
export function pairFiles<F extends FlightFile>(files: F[], overrides: Record<string, string | null> = {}): FlightPair<F>[] {
  const srts = files.filter(isSrt);
  const used = new Set<F>();
  const pairs: FlightPair<F>[] = files.filter(isVideo).map((video) => {
    const wanted = video.name in overrides ? overrides[video.name] : undefined;
    const srt =
      wanted === null
        ? null
        : (srts.find((s) => !used.has(s) && (wanted !== undefined ? s.name === wanted : baseName(s.name) === baseName(video.name))) ?? null);
    if (srt) used.add(srt);
    return { key: baseName(video.name), video, srt };
  });
  for (const srt of srts) if (!used.has(srt)) pairs.push({ key: baseName(srt.name), video: null, srt });
  return pairs.sort((a, b) => a.key.localeCompare(b.key));
}

export interface CameraFields {
  iso?: string;
  shutter?: string;
  aperture?: string;
  focalLength?: string;
  ev?: string;
}

const num = (raw: string) => Number(raw.replace(/^f\/?/i, ""));

/** Only fields present in the cue. Older DJI firmware writes fnum×100 ("280") and focal_len×10 ("240"). */
function cameraFrom(fields: Array<{ key: string; raw: string }>): CameraFields {
  const out: CameraFields = {};
  for (const { key, raw } of fields) {
    const k = key.toLowerCase().replace(/[^a-z]/g, "");
    const v = raw.trim();
    if (!v) continue;
    if (k === "iso") out.iso = v;
    else if (k === "shutter" || k === "ss") out.shutter = v.includes("/") || num(v) <= 1 ? v.replace(/\.0$/, "") : `1/${v}`;
    else if (k === "fnum" && Number.isFinite(num(v))) out.aperture = `f/${!v.includes(".") && num(v) >= 100 ? num(v) / 100 : num(v)}`;
    else if (k === "focallen" && Number.isFinite(num(v))) out.focalLength = `${!v.includes(".") && num(v) >= 100 ? num(v) / 10 : num(v)} mm`;
    else if (k === "ev") out.ev = v;
  }
  return out;
}

export interface FlightStats {
  gpsPoints: number;
  distanceMeters: number | null;
  durationSec: number;
  relativeAltitude: { min: number; max: number } | null;
  absoluteAltitude: { min: number; max: number } | null;
}

export interface LocalFlight {
  points: TelemetryPoint[];
  summary: TelemetrySummary;
  interpolator: TelemetryInterpolator;
  flightPath: FlightPathGeoJson | null; // null when the SRT has no usable GPS
  noGpsMessage: string | null;
  camera: CameraFields[]; // aligned with points
  stats: FlightStats;
  profile: TelemetryProfile;
}

export function loadLocalFlight(srt: Uint8Array | string): LocalFlight {
  let parsed;
  try {
    parsed = parseTelemetry(srt, { coordinateOrder: "auto" });
  } catch (err) {
    if (err instanceof AppError) throw new Error("Unable to read this SRT file.");
    throw err;
  }
  const { points, derived, summary, debug } = parsed;

  const track = extractGpsTrack(points);
  const flightPath = track.coords.length > 0 ? buildFlightPathGeoJson(track, { simplify: true }) : null;
  const rejected = (summary.report.issueCounts.GPS_OUT_OF_RANGE ?? 0) + (summary.report.issueCounts.GPS_SPIKE ?? 0);
  const noGpsMessage = flightPath
    ? null
    : rejected > 0
      ? "GPS data was found, but the coordinates could not be validated."
      : "This SRT contains telemetry but no usable GPS coordinates.";

  const fieldsByCue = new Map(debug.map((d) => [d.cueOrdinal, d.fields]));
  const series = seriesFromJson(toSeriesJson(points, derived));

  return {
    points,
    summary,
    interpolator: createInterpolator(series),
    profile: buildProfile(series),
    flightPath,
    noGpsMessage,
    camera: points.map((p) => cameraFrom(fieldsByCue.get(p.cueOrdinal) ?? [])),
    stats: {
      gpsPoints: points.filter((p) => p.latitude !== null && p.longitude !== null).length,
      distanceMeters: flightPath ? pathLengthMeters(track.coords) : null, // full-resolution track, not the simplified line
      durationSec: summary.timeRange.end - summary.timeRange.start,
      relativeAltitude: summary.relativeAltitudeRange,
      absoluteAltitude: summary.absoluteAltitudeRange,
    },
  };
}

/** SRT time of the GPS sample nearest to a clicked map position. O(n) per click. */
export function nearestTimeTo(points: TelemetryPoint[], lat: number, lng: number): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const p of points) {
    if (p.latitude === null || p.longitude === null) continue;
    const d = haversineMeters(lat, lng, p.latitude, p.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = p.timestamp;
    }
  }
  return best;
}
