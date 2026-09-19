import "server-only";
import type { Prisma, RenderJob } from "@/generated/prisma/client";
import { prisma } from "@/lib/db.server";
import { AppError } from "@/lib/errors/app-error";
import { formatCatalogMessage } from "@/lib/errors/codes";
import { overlayConfigSchema } from "@/lib/overlay/model";
import { computeOutputSize } from "@/lib/video/output-size";
import { toJobDto } from "@/lib/projects/dto.server";
import { getProjectOrThrow, updateProject } from "@/lib/projects/service.server";
import type { ExportSettings, JobDto } from "@/types/api";
import type { OverlayConfig } from "@/types/overlay";
import type { VideoMetadata } from "@/types/video";
import { getJobRunner } from "./runner.server";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

const MAX_JOBS_LISTED = 20;
const ACTIVE_STATUSES = ["QUEUED", "RUNNING"] as const;

async function jobToDto(job: RenderJob): Promise<JobDto> {
  const project = await prisma.project.findUnique({ where: { id: job.projectId }, include: { files: true } });
  const video = (project?.videoMetadata as VideoMetadata | null) ?? null;
  const outputFile = job.outputFileId ? (project?.files.find((f) => f.id === job.outputFileId) ?? null) : null;
  return toJobDto(job, video, outputFile);
}

export async function createExportJob(projectId: string, overlayConfig: OverlayConfig, settings: ExportSettings): Promise<JobDto> {
  const project = await getProjectOrThrow(projectId);
  if (project.status !== "READY" || !project.videoMetadata) throw new AppError("ANALYSIS_REQUIRED");

  const existing = await prisma.renderJob.findFirst({ where: { projectId, status: { in: [...ACTIVE_STATUSES] } } });
  if (existing) throw new AppError("JOB_ALREADY_RUNNING");

  const video = project.videoMetadata as unknown as VideoMetadata;
  const outSize = computeOutputSize(video.video, settings.resolution);
  if ("error" in outSize) throw new AppError("RESOLUTION_UNAVAILABLE");

  const validatedConfig = overlayConfigSchema.parse(overlayConfig);
  await updateProject(projectId, { overlayConfig: validatedConfig });

  const job = await prisma.renderJob.create({
    data: {
      projectId,
      kind: "EXPORT",
      status: "QUEUED",
      settings: toJsonValue(settings),
      overlaySnapshot: toJsonValue(validatedConfig),
      telemetrySettingsSnapshot: toJsonValue(project.telemetrySettings),
    },
  });

  getJobRunner().enqueue(job.id);
  return jobToDto(job);
}

export async function listExportJobs(projectId: string): Promise<JobDto[]> {
  const jobs = await prisma.renderJob.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, take: MAX_JOBS_LISTED });
  return Promise.all(jobs.map(jobToDto));
}

export async function getJobOrThrow(jobId: string): Promise<RenderJob> {
  const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError("JOB_NOT_FOUND");
  return job;
}

export async function getJobDto(jobId: string): Promise<JobDto> {
  return jobToDto(await getJobOrThrow(jobId));
}

export async function cancelJob(jobId: string): Promise<JobDto> {
  const job = await getJobOrThrow(jobId);
  if (job.status !== "QUEUED" && job.status !== "RUNNING") throw new AppError("JOB_NOT_CANCELLABLE");

  const wasQueued = job.status === "QUEUED";
  const inProcess = getJobRunner().cancel(jobId);
  const cancelledData = { status: "CANCELLED" as const, finishedAt: new Date(), errorCode: "EXPORT_CANCELLED", errorMessage: formatCatalogMessage("EXPORT_CANCELLED") };

  if (wasQueued) {
    // A queued job never started running FFmpeg — remove it from the queue and mark it cancelled directly.
    await prisma.renderJob.update({ where: { id: jobId }, data: cancelledData });
  } else if (!inProcess) {
    // RUNNING but not tracked by this process (orphaned after a restart, before startup recovery ran) — cancel directly.
    await prisma.renderJob.update({ where: { id: jobId }, data: cancelledData });
  }
  // else: RUNNING and in-process — the abort signal propagates into export-service.server.ts, which
  // marks the job CANCELLED itself once FFmpeg actually stops.

  return jobToDto(await getJobOrThrow(jobId));
}
