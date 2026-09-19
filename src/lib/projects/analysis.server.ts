import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db.server";
import { AppError } from "@/lib/errors/app-error";
import { buildFlightPathGeoJson, extractGpsTrack } from "@/lib/map/geojson";
import { getStorage } from "@/lib/storage/index.server";
import { parseTelemetry } from "@/lib/telemetry/parser";
import { saveFlightPath, saveTelemetry } from "@/lib/telemetry/persistence.server";
import { pointsToSeries } from "@/lib/telemetry/series";
import { computeSyncReport } from "@/lib/telemetry/sync";
import type { ProjectDto } from "@/types/api";
import type { VideoMetadata } from "@/types/video";
import { toProjectDto, parseTelemetrySettings, type ProjectWithRelations } from "./dto.server";
import { getProjectOrThrow } from "./service.server";

const include = { files: true, jobs: true } as const;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/**
 * status ANALYZING → probe (reuse stored metadata) → parse the SRT → save → summary → sync report → READY.
 * Any AppError sets the project to ERROR with the stored code and message, then re-throws so the route
 * returns the matching HTTP response.
 */
export async function analyzeProject(projectId: string): Promise<ProjectDto> {
  const project = await getProjectOrThrow(projectId);
  const videoFile = project.files.find((f) => f.role === "VIDEO");
  const telemetryFile = project.files.find((f) => f.role === "TELEMETRY");
  if (!videoFile || !telemetryFile) throw new AppError("ANALYSIS_MISSING_FILES");

  await prisma.project.update({ where: { id: projectId }, data: { status: "ANALYZING", errorCode: null, errorMessage: null } });

  try {
    const settings = parseTelemetrySettings(project.telemetrySettings);
    const srtBytes = await getStorage().readBuffer(telemetryFile.storageKey);
    const parsed = parseTelemetry(srtBytes, { coordinateOrder: settings.coordinateOrder });

    const track = extractGpsTrack(parsed.points);
    if (track.coords.length > 0) {
      const flightPath = buildFlightPathGeoJson(track, { simplify: true });
      await saveFlightPath(projectId, flightPath);
      const pathFeature = flightPath.features.find((f) => f.properties.kind === "path");
      parsed.summary.pathLengthMeters = pathFeature && pathFeature.properties.kind === "path" ? pathFeature.properties.lengthMeters : null;
    } else {
      parsed.summary.pathLengthMeters = null;
    }

    await saveTelemetry(projectId, parsed);

    // Video metadata was already probed and stored when the video finished uploading — reuse it.
    const videoMetadata = project.videoMetadata as VideoMetadata | null;
    if (!videoMetadata) throw new AppError("VIDEO_UNREADABLE");

    const series = pointsToSeries(parsed.points);
    const syncReport = computeSyncReport({
      videoDurationSec: videoMetadata.video.durationSec,
      fps: videoMetadata.video.fps.value,
      videoFrameCount: videoMetadata.video.frameCount,
      telemetry: { timeRange: parsed.summary.timeRange, sampleCount: parsed.summary.sampleCount },
      cueBounds: { start: series.start, end: series.end },
      offsetSec: settings.offsetSec,
    });

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "READY",
        errorCode: null,
        errorMessage: null,
        telemetrySummary: toJsonValue(parsed.summary),
        syncReport: toJsonValue(syncReport),
      },
      include,
    });
    return toProjectDto(updated as ProjectWithRelations);
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError("INTERNAL_ERROR", { cause: err });
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "ERROR", errorCode: appError.code, errorMessage: appError.message },
    });
    throw appError;
  }
}
