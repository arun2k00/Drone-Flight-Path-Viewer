import "server-only";
import { AppError } from "@/lib/errors/app-error";
import type { FlightPathGeoJson } from "@/lib/map/geojson";
import { getStorage } from "@/lib/storage/index.server";
import { keys } from "@/lib/storage/keys";
import type { TelemetryDebugRecord, TelemetrySummary } from "@/types/telemetry";
import type { ParsedTelemetry } from "./parser";
import { seriesFromJson, toSeriesJson, type TelemetrySeries, type TelemetrySeriesJson } from "./series";

export interface TelemetryPayload {
  version: 1;
  summary: TelemetrySummary;
  series: TelemetrySeriesJson;
}

interface TelemetryDebugFile {
  version: 1;
  records: TelemetryDebugRecord[];
}

async function readJson<T>(key: string): Promise<T> {
  const storage = getStorage();
  if (!(await storage.exists(key))) throw new AppError("ANALYSIS_REQUIRED");
  const buf = await storage.readBuffer(key);
  return JSON.parse(Buffer.from(buf).toString("utf8")) as T;
}

/** Writes derived/telemetry.v1.json and derived/telemetry-debug.v1.json. Re-analysis overwrites both; the original .srt is never modified. */
export async function saveTelemetry(projectId: string, parsed: ParsedTelemetry): Promise<void> {
  const storage = getStorage();
  const payload: TelemetryPayload = {
    version: 1,
    summary: parsed.summary,
    series: toSeriesJson(parsed.points, parsed.derived),
  };
  await storage.save(keys.telemetryData(projectId), JSON.stringify(payload));

  const debugFile: TelemetryDebugFile = { version: 1, records: parsed.debug };
  await storage.save(keys.telemetryDebug(projectId), JSON.stringify(debugFile));
}

export async function loadTelemetryPayload(projectId: string): Promise<TelemetryPayload> {
  return readJson<TelemetryPayload>(keys.telemetryData(projectId));
}

export async function loadTelemetrySeries(projectId: string): Promise<TelemetrySeries> {
  const payload = await loadTelemetryPayload(projectId);
  return seriesFromJson(payload.series);
}

export async function loadDebugRecords(
  projectId: string,
  offset: number,
  limit: number,
): Promise<{ total: number; records: TelemetryDebugRecord[] }> {
  const file = await readJson<TelemetryDebugFile>(keys.telemetryDebug(projectId));
  return { total: file.records.length, records: file.records.slice(offset, offset + limit) };
}

/** Only called by analysis.server.ts when the track has GPS — its absence is how loadFlightPath distinguishes "no GPS" from "not analyzed". */
export async function saveFlightPath(projectId: string, flightPath: FlightPathGeoJson): Promise<void> {
  await getStorage().save(keys.flightPath(projectId), JSON.stringify(flightPath));
}

export async function loadFlightPath(projectId: string): Promise<FlightPathGeoJson> {
  const storage = getStorage();
  if (!(await storage.exists(keys.telemetryData(projectId)))) throw new AppError("ANALYSIS_REQUIRED");
  if (!(await storage.exists(keys.flightPath(projectId)))) throw new AppError("TELEMETRY_NO_GPS");
  const buf = await storage.readBuffer(keys.flightPath(projectId));
  return JSON.parse(Buffer.from(buf).toString("utf8")) as FlightPathGeoJson;
}
