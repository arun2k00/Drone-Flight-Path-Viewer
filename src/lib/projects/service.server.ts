import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db.server";
import { AppError } from "@/lib/errors/app-error";
import { placeholderOverlayConfig } from "@/lib/overlay/defaults";
import { keys } from "@/lib/storage/keys";
import { getStorage } from "@/lib/storage/index.server";
import { loadTelemetrySeries } from "@/lib/telemetry/persistence.server";
import { computeSyncReport } from "@/lib/telemetry/sync";
import type { FileRole, ProjectDto, ProjectListItemDto, StoredFileDto } from "@/types/api";
import type { OverlayConfig } from "@/types/overlay";
import type { VideoMetadata } from "@/types/video";
import { DEFAULT_TELEMETRY_SETTINGS, type TelemetrySettings, type TelemetrySummary } from "@/types/telemetry";
import {
  parseTelemetrySettings,
  toProjectDto,
  toProjectListItemDto,
  toStoredFileDto,
  type ProjectWithRelations,
} from "./dto.server";

const include = { files: true, jobs: true } as const;

/** OverlayConfig/TelemetrySettings are plain interfaces (no index signature); Prisma's Json input needs one. */
function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** A user's own projects, newest first. */
export async function listProjects(userId: string): Promise<ProjectListItemDto[]> {
  const projects = await prisma.project.findMany({ where: { userId }, include, orderBy: { createdAt: "desc" } });
  return projects.map((p) => toProjectListItemDto(p as ProjectWithRelations));
}

export async function createProject(input: { name: string; companyName?: string | null; userId?: string | null }): Promise<ProjectDto> {
  const project = await prisma.project.create({
    data: {
      name: input.name,
      userId: input.userId ?? null,
      companyName: input.companyName ?? null,
      telemetrySettings: toJsonValue(DEFAULT_TELEMETRY_SETTINGS),
      overlayConfig: toJsonValue(placeholderOverlayConfig()),
    },
    include,
  });
  return toProjectDto(project as ProjectWithRelations);
}

export async function getProjectOrThrow(projectId: string): Promise<ProjectWithRelations> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include });
  if (!project) throw new AppError("PROJECT_NOT_FOUND");
  return project as ProjectWithRelations;
}

export async function getProjectDto(projectId: string): Promise<ProjectDto> {
  return toProjectDto(await getProjectOrThrow(projectId));
}

export interface UpdateProjectInput {
  name?: string;
  companyName?: string | null;
  telemetrySettings?: Partial<TelemetrySettings>;
  overlayConfig?: OverlayConfig;
}

export async function updateProject(projectId: string, input: UpdateProjectInput): Promise<ProjectDto> {
  const existing = await getProjectOrThrow(projectId);
  const previousSettings = parseTelemetrySettings(existing.telemetrySettings);
  const nextTelemetrySettings = input.telemetrySettings ? { ...previousSettings, ...input.telemetrySettings } : undefined;
  // Re-parsing-affecting settings reset the project to DRAFT.
  const requiresReparse = input.telemetrySettings?.coordinateOrder !== undefined;
  const offsetChanged =
    nextTelemetrySettings !== undefined && !requiresReparse && nextTelemetrySettings.offsetSec !== previousSettings.offsetSec;

  // PATCH offsetSec recomputes syncReport in place, without a full re-analysis.
  let syncReportUpdate: { syncReport: Prisma.InputJsonValue } | Record<string, never> = {};
  if (offsetChanged && existing.telemetrySummary && existing.videoMetadata) {
    const summary = existing.telemetrySummary as unknown as TelemetrySummary;
    const videoMetadata = existing.videoMetadata as unknown as VideoMetadata;
    const series = await loadTelemetrySeries(projectId);
    const syncReport = computeSyncReport({
      videoDurationSec: videoMetadata.video.durationSec,
      fps: videoMetadata.video.fps.value,
      videoFrameCount: videoMetadata.video.frameCount,
      telemetry: { timeRange: summary.timeRange, sampleCount: summary.sampleCount },
      cueBounds: { start: series.start, end: series.end },
      offsetSec: nextTelemetrySettings.offsetSec,
    });
    syncReportUpdate = { syncReport: toJsonValue(syncReport) };
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(nextTelemetrySettings ? { telemetrySettings: toJsonValue(nextTelemetrySettings) } : {}),
      ...(input.overlayConfig ? { overlayConfig: toJsonValue(input.overlayConfig) } : {}),
      ...(requiresReparse ? { status: "DRAFT" } : {}),
      ...syncReportUpdate,
    },
    include,
  });
  return toProjectDto(project as ProjectWithRelations);
}

export interface ReplaceStoredFileInput {
  role: Extract<FileRole, "VIDEO" | "TELEMETRY" | "LOGO">;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Replacing a file deletes the previous StoredFile of that role (and its storage object, unless the
 * new upload landed at the same key) and resets the analysis fields that depended on it.
 */
export async function replaceStoredFile(projectId: string, input: ReplaceStoredFileInput): Promise<StoredFileDto> {
  const project = await getProjectOrThrow(projectId);
  const previous = project.files.find((f) => f.role === input.role);

  if (previous && previous.storageKey !== input.storageKey) {
    await getStorage()
      .delete(previous.storageKey)
      .catch(() => {});
  }
  if (previous) {
    await prisma.storedFile.delete({ where: { id: previous.id } });
  }

  const stored = await prisma.storedFile.create({
    data: {
      projectId,
      role: input.role,
      originalName: input.originalName,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    },
  });

  const resetFields: Prisma.ProjectUpdateInput =
    input.role === "VIDEO"
      ? { videoMetadata: Prisma.JsonNull, status: "DRAFT" }
      : input.role === "TELEMETRY"
        ? { telemetrySummary: Prisma.JsonNull, syncReport: Prisma.JsonNull, status: "DRAFT" }
        : {};
  if (Object.keys(resetFields).length > 0) {
    await prisma.project.update({ where: { id: projectId }, data: resetFields });
  }

  return toStoredFileDto(stored);
}

/** Removes the logo (both the rasterized PNG and the original source backup) without touching anything else. */
export async function removeLogo(projectId: string): Promise<void> {
  const project = await getProjectOrThrow(projectId);
  const logo = project.files.find((f) => f.role === "LOGO");
  if (!logo) return;
  await getStorage().delete(logo.storageKey).catch(() => {});
  await prisma.storedFile.delete({ where: { id: logo.id } });
  for (const ext of [".png", ".svg", ".webp"] as const) {
    await getStorage()
      .delete(keys.logoSource(projectId, ext))
      .catch(() => {});
  }
}

export async function setVideoMetadata(projectId: string, metadata: VideoMetadata): Promise<void> {
  await prisma.project.update({ where: { id: projectId }, data: { videoMetadata: toJsonValue(metadata) } });
}

export async function deleteProject(projectId: string): Promise<void> {
  const project = await getProjectOrThrow(projectId);
  const runningJob = project.jobs.find((job) => job.status === "QUEUED" || job.status === "RUNNING");
  if (runningJob) throw new AppError("JOB_ALREADY_RUNNING");
  await prisma.project.delete({ where: { id: projectId } });
  await getStorage().deletePrefix(keys.projectPrefix(projectId));
}
