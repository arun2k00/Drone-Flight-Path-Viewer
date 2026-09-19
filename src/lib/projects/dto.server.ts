import "server-only";
import { z } from "zod";
import type { Project, RenderJob, StoredFile } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors/app-error";
import type {
  ExportPhase,
  ExportSettings,
  FileRole,
  JobDto,
  JobStatus,
  ProjectDto,
  ProjectListItemDto,
  ProjectStatus,
  StoredFileDto,
  WarningDto,
} from "@/types/api";
import { overlayConfigSchema } from "@/lib/overlay/model";
import { computeOutputSize } from "@/lib/video/output-size";
import type { OverlayConfig } from "@/types/overlay";
import type { SyncReport, TelemetrySettings, TelemetrySummary } from "@/types/telemetry";
import type { VideoMetadata } from "@/types/video";

const telemetrySettingsSchema = z.object({
  offsetSec: z.number(),
  speedSource: z.enum(["auto", "srt-only"]),
  headingFallback: z.enum(["none", "gps-course"]),
  coordinateOrder: z.enum(["auto", "lat-lon", "lon-lat"]),
});

/** Every Json column is parsed with its zod schema when read. */
export function parseTelemetrySettings(value: unknown): TelemetrySettings {
  const parsed = telemetrySettingsSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError("INTERNAL_ERROR", {
      logDetail: { reason: "invalid telemetrySettings JSON", issues: parsed.error.issues },
    });
  }
  return parsed.data;
}

export function parseOverlayConfig(value: unknown): OverlayConfig {
  const parsed = overlayConfigSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError("INTERNAL_ERROR", {
      logDetail: { reason: "invalid overlayConfig JSON", issues: parsed.error.issues },
    });
  }
  return parsed.data;
}

export function toStoredFileDto(file: StoredFile): StoredFileDto {
  return {
    id: file.id,
    role: file.role as FileRole,
    originalName: file.originalName,
    sizeBytes: file.sizeBytes,
    mimeType: file.mimeType,
    createdAt: file.createdAt.toISOString(),
  };
}

function findFile(files: StoredFile[], role: FileRole): StoredFileDto | null {
  const file = files.find((f) => f.role === role);
  return file ? toStoredFileDto(file) : null;
}

export type ProjectWithRelations = Project & { files: StoredFile[]; jobs: RenderJob[] };

export function toProjectDto(project: ProjectWithRelations): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    companyName: project.companyName,
    status: project.status as ProjectStatus,
    error: project.errorCode ? { code: project.errorCode, message: project.errorMessage ?? "" } : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    files: {
      video: findFile(project.files, "VIDEO"),
      telemetry: findFile(project.files, "TELEMETRY"),
      logo: findFile(project.files, "LOGO"),
    },
    videoMetadata: (project.videoMetadata as VideoMetadata | null) ?? null,
    telemetrySummary: (project.telemetrySummary as TelemetrySummary | null) ?? null,
    syncReport: (project.syncReport as SyncReport | null) ?? null,
    telemetrySettings: parseTelemetrySettings(project.telemetrySettings),
    overlayConfig: parseOverlayConfig(project.overlayConfig),
  };
}

export function toProjectListItemDto(project: ProjectWithRelations): ProjectListItemDto {
  const videoMetadata = project.videoMetadata as VideoMetadata | null;
  const lastJob = [...project.jobs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return {
    id: project.id,
    name: project.name,
    status: project.status as ProjectStatus,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    durationSec: videoMetadata?.video.durationSec ?? null,
    resolution: videoMetadata ? `${videoMetadata.video.width}×${videoMetadata.video.height}` : null,
    lastExport: lastJob
      ? {
          jobId: lastJob.id,
          status: lastJob.status as JobStatus,
          finishedAt: lastJob.finishedAt ? lastJob.finishedAt.toISOString() : null,
        }
      : null,
  };
}

/** export-pipeline.md estimate. Uses `startedAt` as a proxy for "time in ENCODING_VIDEO" — the phases before it are a small, bounded slice (0 → 0.08). */
function computeEtaSec(job: RenderJob): number | null {
  if (job.phase !== "ENCODING_VIDEO" || !job.startedAt || job.progress <= 0.08) return null;
  const elapsedSec = (Date.now() - job.startedAt.getTime()) / 1000;
  if (elapsedSec < 3) return null;
  const f = Math.min(1, Math.max(0, (job.progress - 0.08) / 0.89));
  if (f <= 0) return null;
  return elapsedSec * (1 - f) / Math.max(f, 1e-6) + 0.03 * elapsedSec;
}

export function toJobDto(job: RenderJob, video: VideoMetadata | null, outputFile: StoredFile | null): JobDto {
  const settings = job.settings as unknown as ExportSettings;
  const outSize = video ? computeOutputSize(video.video, settings.resolution) : null;
  return {
    id: job.id,
    projectId: job.projectId,
    kind: "EXPORT",
    status: job.status as JobStatus,
    phase: (job.phase as ExportPhase | null) ?? null,
    progress: job.progress,
    framesDone: job.framesDone ?? null,
    framesTotal: job.framesTotal ?? null,
    etaSec: job.status === "RUNNING" ? computeEtaSec(job) : null,
    settings,
    output:
      outputFile && outSize && !("error" in outSize)
        ? {
            fileName: outputFile.originalName,
            sizeBytes: outputFile.sizeBytes,
            width: outSize.width,
            height: outSize.height,
            downloadUrl: `/api/jobs/${job.id}/download`,
          }
        : null,
    warnings: (job.warnings as unknown as WarningDto[] | null) ?? [],
    error: job.errorCode ? { code: job.errorCode, message: job.errorMessage ?? "" } : null,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
  };
}
