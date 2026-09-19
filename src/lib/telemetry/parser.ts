import { AppError } from "@/lib/errors/app-error";
import type {
  IssueCode,
  ParseIssue,
  ParseReport,
  TelemetryDebugRecord,
  TelemetryNumericField,
  TelemetryPoint,
  TelemetrySettings,
  TelemetrySummary,
} from "@/types/telemetry";
import { deriveGpsSeries, type DerivedGpsSeries } from "./derive";
import { mapKey, normalizeKey } from "./fields";
import { decodeSrtBytes, tokenizeSrt } from "./srt-cues";
import { pointsToSeries } from "./series";
import { STRATEGIES } from "./strategies";
import { buildSummary } from "./summary";
import { filterGpsSpikes, validateRecord } from "./validator";

export interface ParsedTelemetry {
  points: TelemetryPoint[];
  derived: DerivedGpsSeries; // aligned with points
  debug: TelemetryDebugRecord[];
  report: ParseReport;
  summary: TelemetrySummary; // pathLengthMeters filled by caller
}

const NUMERIC_FIELDS: TelemetryNumericField[] = [
  "latitude",
  "longitude",
  "relativeAltitude",
  "absoluteAltitude",
  "speedX",
  "speedY",
  "speedZ",
  "speed",
  "heading",
  "aircraftPitch",
  "aircraftRoll",
  "aircraftYaw",
  "gimbalPitch",
  "gimbalRoll",
  "gimbalYaw",
];

const DETECTION_THRESHOLD = 0.2;
const DETECTION_SAMPLE_SIZE = 50;

/** Deterministic parsing: decode → tokenize → detect strategy → per-cue extract/validate → order → spike filter → derive → summarize. */
export function parseTelemetry(input: Uint8Array | string, settings: Pick<TelemetrySettings, "coordinateOrder">): ParsedTelemetry {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const { text, encoding, replacementRatio } = decodeSrtBytes(bytes);
  if (replacementRatio > 0.01) throw new AppError("SRT_INVALID");

  const cues = tokenizeSrt(text);
  const issues: ParseIssue[] = [];
  const addIssue = (code: IssueCode, cueOrdinal: number | null, message: string, extra?: { field?: TelemetryNumericField }) =>
    issues.push({ code, cueOrdinal, line: null, field: extra?.field, message });

  const validCues = cues.filter((c) => !("error" in c.timing) && c.payload.trim() !== "");
  const samples = validCues.slice(0, DETECTION_SAMPLE_SIZE).map((c) => c.payload);
  if (samples.length === 0) throw new AppError("TELEMETRY_NO_RECOGNIZED_FIELDS");

  let best = STRATEGIES[0];
  let bestScore = 0;
  for (const strategy of STRATEGIES) {
    const score = strategy.detect(samples);
    if (score > bestScore + 1e-12) {
      best = strategy;
      bestScore = score;
    }
  }
  if (bestScore < DETECTION_THRESHOLD) throw new AppError("TELEMETRY_NO_RECOGNIZED_FIELDS");

  const ctx = best.prepare(
    validCues.map((c) => c.payload),
    settings,
  );
  if (ctx.orderAssumed) {
    addIssue(
      "GPS_TUPLE_ORDER_ASSUMED",
      null,
      "GPS coordinate order couldn't be detected; longitude, latitude was assumed.",
    );
  }

  let parsedRecords = 0;
  let ignoredCues = 0;
  let invalidRecords = 0;
  const unknownKeys = new Set<string>();
  const debug: TelemetryDebugRecord[] = [];
  interface Draft {
    point: TelemetryPoint;
    speedFromComponents: boolean;
  }
  const draft: Draft[] = [];

  for (const cue of cues) {
    if ("error" in cue.timing) {
      invalidRecords++;
      const message = cue.timing.error === "BAD_TIMESTAMP" ? "Cue timing could not be parsed." : "Cue end time is before its start time.";
      addIssue(cue.timing.error, cue.ordinal, message);
      debug.push({ cueOrdinal: cue.ordinal, index: cue.index, startTime: null, endTime: null, line: cue.line, status: "invalid", rawText: cue.payload, fields: [], issues: [] });
      continue;
    }
    if (cue.payload.trim() === "") {
      ignoredCues++;
      addIssue("EMPTY_PAYLOAD", cue.ordinal, "Cue has no payload text.");
      debug.push({ cueOrdinal: cue.ordinal, index: cue.index, startTime: cue.timing.startTime, endTime: cue.timing.endTime, line: cue.line, status: "ignored", rawText: cue.payload, fields: [], issues: [] });
      continue;
    }

    const ex = best.extract(cue.payload, ctx);
    const validated = validateRecord(ex.fields, cue.ordinal);
    for (const key of validated.unknownKeys) unknownKeys.add(key);

    const debugFields: TelemetryDebugRecord["fields"] = ex.fields.map((f) => ({ key: f.key, raw: f.raw, mappedTo: mapKey(normalizeKey(f.key)) }));
    if (ex.frameIndex !== null) debugFields.push({ key: "frameIndex", raw: String(ex.frameIndex), mappedTo: "frameIndex" });
    if (ex.recordedAt) debugFields.push({ key: "recordedAt", raw: ex.recordedAt.text, mappedTo: "recordedAt" });

    if (validated.mappedCount === 0) {
      ignoredCues++;
      addIssue("NO_FIELDS", cue.ordinal, "No recognized telemetry fields in this cue.");
      debug.push({ cueOrdinal: cue.ordinal, index: cue.index, startTime: cue.timing.startTime, endTime: cue.timing.endTime, line: cue.line, status: "ignored", rawText: cue.payload, fields: debugFields, issues: [] });
      continue;
    }

    issues.push(...validated.issues);
    const point: TelemetryPoint = {
      timestamp: (cue.timing.startTime + cue.timing.endTime) / 2,
      startTime: cue.timing.startTime,
      endTime: cue.timing.endTime,
      latitude: validated.fields.latitude,
      longitude: validated.fields.longitude,
      relativeAltitude: validated.fields.relativeAltitude,
      absoluteAltitude: validated.fields.absoluteAltitude,
      speedX: validated.fields.speedX,
      speedY: validated.fields.speedY,
      speedZ: validated.fields.speedZ,
      speed: validated.fields.speed,
      heading: validated.fields.heading,
      aircraftPitch: validated.fields.aircraftPitch,
      aircraftRoll: validated.fields.aircraftRoll,
      aircraftYaw: validated.fields.aircraftYaw,
      gimbalPitch: validated.fields.gimbalPitch,
      gimbalRoll: validated.fields.gimbalRoll,
      gimbalYaw: validated.fields.gimbalYaw,
      recordedAt: ex.recordedAt?.text ?? null,
      frameIndex: ex.frameIndex,
      cueOrdinal: cue.ordinal,
    };
    parsedRecords++;
    draft.push({ point, speedFromComponents: validated.fields.speedFromComponents });
    debug.push({ cueOrdinal: cue.ordinal, index: cue.index, startTime: cue.timing.startTime, endTime: cue.timing.endTime, line: cue.line, status: "parsed", rawText: cue.payload, fields: debugFields, issues: [] });
  }

  // 2 ordering + duplicate timestamps
  let inversions = 0;
  for (let i = 1; i < draft.length; i++) if (draft[i].point.startTime < draft[i - 1].point.startTime) inversions++;
  if (inversions > 0) addIssue("OUT_OF_ORDER", null, `${inversions} cue(s) were out of chronological order and were sorted by time.`);

  const sorted = draft
    .map((d, i) => ({ d, i }))
    .sort((a, b) => a.d.point.startTime - b.d.point.startTime || a.i - b.i)
    .map(({ d }) => d);

  const points: TelemetryPoint[] = [];
  const speedFromComponents: boolean[] = [];
  for (const d of sorted) {
    if (points.length && points[points.length - 1].startTime === d.point.startTime) {
      ignoredCues++;
      parsedRecords--;
      addIssue("DUPLICATE_TIME", d.point.cueOrdinal, "Duplicate timestamp; a later cue with the same time was dropped.");
      continue;
    }
    points.push(d.point);
    speedFromComponents.push(d.speedFromComponents);
  }

  // 3 GPS spike filter (mutates points in place)
  issues.push(...filterGpsSpikes(points));

  // Debug records are built as each cue is processed, before spike/ordering/duplicate issues exist —
  // resync every record's issue list against the final, complete issues array.
  const issuesByCue = new Map<number | null, ParseIssue[]>();
  for (const issue of issues) {
    const list = issuesByCue.get(issue.cueOrdinal) ?? [];
    list.push(issue);
    issuesByCue.set(issue.cueOrdinal, list);
  }
  for (const record of debug) record.issues = issuesByCue.get(record.cueOrdinal) ?? [];

  const timeRange = points.length
    ? { start: Math.min(...points.map((p) => p.startTime)), end: Math.max(...points.map((p) => p.endTime)) }
    : { start: 0, end: 0 };
  const series = pointsToSeries(points);
  const derived = deriveGpsSeries(series, timeRange);

  const issueCounts: Partial<Record<IssueCode, number>> = {};
  for (const issue of issues) issueCounts[issue.code] = (issueCounts[issue.code] ?? 0) + 1;

  const fieldCoverage = Object.fromEntries(
    NUMERIC_FIELDS.map((field) => [field, points.filter((p) => p[field] !== null).length]),
  ) as Record<TelemetryNumericField, number>;

  const report: ParseReport = {
    parserId: best.id,
    parserVersion: best.version,
    encoding,
    totalCues: cues.length,
    parsedRecords,
    ignoredCues,
    invalidRecords,
    issueCounts,
    issues: issues.slice(0, 200),
    fieldCoverage,
    unknownKeys: [...unknownKeys].sort().slice(0, 100),
    coordinateOrder: ctx.coordinateOrder,
  };

  const summary = buildSummary(points, speedFromComponents, derived, report, timeRange, null);

  return { points, derived, debug, report, summary };
}
