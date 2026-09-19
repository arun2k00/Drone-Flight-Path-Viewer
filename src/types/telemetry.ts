import type { WarningDto } from "./api";

export type ParserId = "DJI_SRT_BRACKET" | "DJI_SRT_INLINE" | "GENERIC_KEY_VALUE";

/** Spec model plus timing boundaries and bookkeeping. */
export interface TelemetryPoint {
  timestamp: number; // seconds on the SRT timeline = (startTime + endTime) / 2
  startTime: number; // cue start, seconds
  endTime: number; // cue end, seconds
  latitude: number | null;
  longitude: number | null;
  relativeAltitude: number | null; // metres above take-off
  absoluteAltitude: number | null; // metres, as reported by the aircraft
  speedX: number | null; // m/s
  speedY: number | null; // m/s
  speedZ: number | null; // m/s
  speed: number | null; // m/s horizontal: SRT field or √(vx²+vy²). NEVER GPS-derived.
  heading: number | null; // degrees [0,360): SRT heading/yaw only
  aircraftPitch: number | null; // degrees
  aircraftRoll: number | null; // degrees
  aircraftYaw: number | null; // degrees (-180,180]
  gimbalPitch: number | null;
  gimbalRoll: number | null;
  gimbalYaw: number | null; // degrees (-180,180]
  recordedAt: string | null; // "YYYY-MM-DD HH:MM:SS.mmm" wall clock as recorded (no timezone)
  frameIndex: number | null; // FrameCnt / SrtCnt
  cueOrdinal: number; // 0-based position among ALL cues in the file (as tokenized)
}

export type TelemetryNumericField =
  | "latitude"
  | "longitude"
  | "relativeAltitude"
  | "absoluteAltitude"
  | "speedX"
  | "speedY"
  | "speedZ"
  | "speed"
  | "heading"
  | "aircraftPitch"
  | "aircraftRoll"
  | "aircraftYaw"
  | "gimbalPitch"
  | "gimbalRoll"
  | "gimbalYaw";

export type IssueCode =
  | "BAD_TIMESTAMP"
  | "END_BEFORE_START"
  | "EMPTY_PAYLOAD"
  | "NO_FIELDS"
  | "OUT_OF_ORDER"
  | "DUPLICATE_TIME"
  | "DUPLICATE_KEY"
  | "GPS_NO_FIX"
  | "GPS_OUT_OF_RANGE"
  | "GPS_PARTIAL"
  | "GPS_SPIKE"
  | "VALUE_OUT_OF_RANGE"
  | "GPS_TUPLE_ORDER_ASSUMED"
  | "ENCODING_REPLACED_CHARS";

export interface ParseIssue {
  code: IssueCode;
  cueOrdinal: number | null;
  line: number | null; // 1-based line of the cue's timing line
  field?: TelemetryNumericField;
  message: string; // developer-facing, shown only in the debug view
}

export interface ParseReport {
  parserId: ParserId;
  parserVersion: number; // bump when parsing rules change (starts at 1)
  encoding: "utf-8" | "utf-16le" | "utf-16be";
  totalCues: number; // every cue with a timing line (valid or not)
  parsedRecords: number; // cues that produced a TelemetryPoint
  ignoredCues: number; // valid timing but empty payload / no recognized fields / duplicate time
  invalidRecords: number; // bad or reversed timing
  issueCounts: Partial<Record<IssueCode, number>>;
  issues: ParseIssue[]; // first 200 only
  fieldCoverage: Record<TelemetryNumericField, number>; // non-null counts after validation
  unknownKeys: string[]; // lower-cased original keys seen but not mapped (sorted, max 100)
  coordinateOrder: "named" | "lat-lon" | "lon-lat";
}

export type SpeedCapability = "srt" | "srt-components" | "gps-derived" | "none";

export interface TelemetryCapabilities {
  gps: boolean; // ≥ 2 valid GPS samples
  relativeAltitude: boolean; // ≥ 1 non-null
  absoluteAltitude: boolean;
  speed: SpeedCapability; // what "auto" speed resolves to
  heading: "srt" | "none";
  course: boolean; // ≥ 1 non-null derived course
  attitude: boolean; // any aircraft pitch/roll/yaw
  gimbal: boolean; // any gimbal pitch/roll/yaw
  recordedAt: boolean;
}

export interface GeoBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface TelemetrySummary {
  parserId: ParserId;
  parserVersion: number;
  sampleCount: number;
  timeRange: { start: number; end: number }; // first cue start … last cue end (parsed records)
  medianIntervalSec: number | null; // median of consecutive timestamp deltas
  estimatedRateHz: number | null; // 1 / medianIntervalSec
  capabilities: TelemetryCapabilities;
  gpsCoverage: number; // valid GPS samples / sampleCount (0..1)
  firstFix: { latitude: number; longitude: number; time: number } | null;
  lastFix: { latitude: number; longitude: number; time: number } | null;
  bounds: GeoBounds | null;
  relativeAltitudeRange: { min: number; max: number } | null;
  absoluteAltitudeRange: { min: number; max: number } | null;
  maxSpeedMps: number | null; // using the "auto" speed resolution
  pathLengthMeters: number | null; // simplified path length
  recordedAtStart: string | null;
  recordedAtEnd: string | null;
  warnings: WarningDto[];
  report: ParseReport;
}

export interface TelemetrySettings {
  offsetSec: number; // srtTime = videoTime − offsetSec
  speedSource: "auto" | "srt-only";
  headingFallback: "none" | "gps-course";
  coordinateOrder: "auto" | "lat-lon" | "lon-lat"; // affects GPS(...) tuples only
}

export const DEFAULT_TELEMETRY_SETTINGS: TelemetrySettings = {
  offsetSec: 0,
  speedSource: "auto",
  headingFallback: "none",
  coordinateOrder: "auto",
};

export type SyncStatus = "GOOD" | "WARNING" | "MISMATCH" | "NO_OVERLAP";

export interface SyncReport {
  status: SyncStatus;
  videoDurationSec: number;
  telemetryStartSec: number;
  telemetryEndSec: number;
  offsetSec: number;
  overlapSec: number;
  coverage: number; // overlap / video duration
  startDeltaSec: number; // (telemetryStart + offset) − 0
  endDeltaSec: number; // (telemetryEnd + offset) − videoDuration
  videoFrameCount: number | null;
  recordsPerFrame: number | null;
  gapCount: number; // gaps > 1.0 s between consecutive cues
  longestGapSec: number;
  messages: WarningDto[];
}

export interface TelemetryDebugRecord {
  cueOrdinal: number;
  index: number | null;
  startTime: number | null;
  endTime: number | null;
  line: number;
  status: "parsed" | "ignored" | "invalid";
  rawText: string; // payload exactly as in the file (after newline normalization)
  fields: Array<{ key: string; raw: string; mappedTo: TelemetryNumericField | "frameIndex" | "recordedAt" | null }>;
  issues: ParseIssue[];
}
