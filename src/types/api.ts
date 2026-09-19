import type { OverlayConfig } from "./overlay";
import type { SyncReport, TelemetrySettings, TelemetrySummary } from "./telemetry";
import type { VideoMetadata } from "./video";

export type ProjectStatus = "DRAFT" | "ANALYZING" | "READY" | "ERROR";
export type FileRole = "VIDEO" | "TELEMETRY" | "LOGO" | "LOGO_SOURCE" | "EXPORT";
export type UploadRole = "VIDEO" | "TELEMETRY" | "LOGO";
export type UploadStatus = "PENDING" | "COMPLETE" | "ABORTED";
export type JobStatus = "QUEUED" | "RUNNING" | "COMPLETE" | "FAILED" | "CANCELLED";
export type ExportPhase =
  | "PREPARING_TELEMETRY"
  | "GENERATING_FLIGHT_PATH"
  | "RENDERING_OVERLAY"
  | "ENCODING_VIDEO"
  | "FINALIZING";

export interface StoredFileDto {
  id: string;
  role: FileRole;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
}

export interface ProjectListItemDto {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  durationSec: number | null;
  resolution: string | null; // e.g. "3840×2160"
  lastExport: { jobId: string; status: JobStatus; finishedAt: string | null } | null;
}

export interface ProjectDto {
  id: string;
  name: string;
  companyName: string | null;
  status: ProjectStatus;
  error: { code: string; message: string } | null;
  createdAt: string;
  updatedAt: string;
  files: { video: StoredFileDto | null; telemetry: StoredFileDto | null; logo: StoredFileDto | null };
  videoMetadata: VideoMetadata | null;
  telemetrySummary: TelemetrySummary | null;
  syncReport: SyncReport | null;
  telemetrySettings: TelemetrySettings;
  overlayConfig: OverlayConfig;
}

export interface UploadSessionDto {
  id: string;
  role: UploadRole;
  sizeBytes: number;
  receivedBytes: number;
  chunkSize: number;
  status: UploadStatus;
}

export interface ExportSettings {
  resolution: "original" | "1080p" | "2160p";
  quality: "high" | "balanced" | "small";
}

export interface WarningDto {
  code: string;
  message: string;
}

export interface JobDto {
  id: string;
  projectId: string;
  kind: "EXPORT";
  status: JobStatus;
  phase: ExportPhase | null;
  progress: number; // 0..1 overall
  framesDone: number | null;
  framesTotal: number | null;
  etaSec: number | null; // null until ≥ 3 s of ENCODING_VIDEO elapsed
  settings: ExportSettings;
  output: { fileName: string; sizeBytes: number; width: number; height: number; downloadUrl: string } | null;
  warnings: WarningDto[];
  error: { code: string; message: string } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
