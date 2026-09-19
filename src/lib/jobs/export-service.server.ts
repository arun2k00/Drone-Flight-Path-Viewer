import "server-only";
import fsp from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import type { Prisma } from "@/generated/prisma/client";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { AppError } from "@/lib/errors/app-error";
import { formatCatalogMessage, type ErrorCode } from "@/lib/errors/codes";
import { logger } from "@/lib/errors/logger.server";
import { boundsOf } from "@/lib/map/geojson";
import { fitViewport } from "@/lib/map/projection";
import { renderBasemap } from "@/lib/map/basemap.server";
import { isDynamic } from "@/lib/overlay/classify";
import { buildAtlasLayout } from "@/lib/overlay/atlas";
import { loadImageFromBuffer, registerOverlayFonts } from "@/lib/overlay/assets.server";
import type { FrameState } from "@/lib/overlay/frame-state";
import { buildFrameState } from "@/lib/overlay/frame-state";
import { toPixelRect, unitOf } from "@/lib/overlay/layout";
import type { OverlayElement } from "@/lib/overlay/model";
import { drawElement, type RenderContext } from "@/lib/overlay/render";
import { parseOverlayConfig, parseTelemetrySettings } from "@/lib/projects/dto.server";
import { slugify } from "@/lib/format/slug";
import { createInterpolator } from "@/lib/telemetry/interpolator";
import { loadFlightPath, loadTelemetrySeries } from "@/lib/telemetry/persistence.server";
import { buildProfile } from "@/lib/telemetry/profile";
import { notifyExportFinished } from "./notify.server";
import { getStorage } from "@/lib/storage/index.server";
import { statfsFree } from "@/lib/storage/filesystem.server";
import { keys } from "@/lib/storage/keys";
import { exportTempDir } from "@/lib/storage/temp.server";
import { buildExportArgs } from "@/lib/video/export-args";
import { writeAtlasFrames } from "@/lib/video/frame-writer.server";
import { computeOutputSize } from "@/lib/video/output-size";
import { probeVideo } from "@/lib/video/probe.server";
import { collectStderrRing, killFfmpeg, spawnFfmpeg } from "@/lib/video/process.server";
import { FfmpegProgressParser } from "@/lib/video/progress-parser";
import type { ExportPhase, ExportSettings, WarningDto } from "@/types/api";
import type { FlightPathGeoJson } from "@/lib/map/geojson";
import type { SyncReport, TelemetrySummary } from "@/types/telemetry";
import type { VideoMetadata } from "@/types/video";

const GIB = 1024 * 1024 * 1024;

class CancelledError extends Error {}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function warn(code: ErrorCode, details?: Record<string, unknown>): WarningDto {
  return { code, message: formatCatalogMessage(code, details) };
}

function checkAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new CancelledError();
}

interface JobContext {
  signal: AbortSignal;
  setPhase(phase: ExportPhase): Promise<void>;
  setProgress(progress: number, frames?: { done?: number; total?: number }): Promise<void>;
  addWarning(code: ErrorCode, details?: Record<string, unknown>): void;
  warnings: WarningDto[];
}

function createJobContext(jobId: string, signal: AbortSignal): JobContext {
  const warnings: WarningDto[] = [];
  let lastWriteMs = 0;

  async function persist(data: Prisma.RenderJobUpdateInput): Promise<void> {
    await prisma.renderJob.update({ where: { id: jobId }, data: { ...data, warnings: toJson(warnings) } }).catch((err: unknown) => {
      logger.warn("export", "job progress write failed", { jobId, err: { message: err instanceof Error ? err.message : String(err) } });
    });
  }

  return {
    signal,
    warnings,
    async setPhase(phase) {
      lastWriteMs = Date.now();
      await persist({ phase });
    },
    async setProgress(progress, frames) {
      const now = Date.now();
      if (now - lastWriteMs < 500) return;
      lastWriteMs = now;
      await persist({ progress, ...(frames?.done !== undefined ? { framesDone: frames.done } : {}), ...(frames?.total !== undefined ? { framesTotal: frames.total } : {}) });
    },
    addWarning(code, details) {
      warnings.push(warn(code, details));
    },
  };
}

/** Re-probes the exported file and checks it against what was requested. */
async function verifyOutput(outputPath: string, expected: { width: number; height: number; durationSec: number; fps: number; hasAudio: boolean }): Promise<VideoMetadata> {
  let stat: { size: number };
  try {
    stat = await fsp.stat(outputPath);
  } catch {
    throw new AppError("EXPORT_VERIFY_FAILED", { logDetail: { reason: "output file missing" } });
  }
  if (stat.size <= 0) throw new AppError("EXPORT_VERIFY_FAILED", { logDetail: { reason: "output file empty" } });

  let metadata: VideoMetadata;
  try {
    metadata = await probeVideo(outputPath, stat.size);
  } catch (err) {
    throw new AppError("EXPORT_VERIFY_FAILED", { logDetail: { reason: "ffprobe failed", err: err instanceof Error ? err.message : String(err) } });
  }
  if (metadata.video.codec !== "h264") throw new AppError("EXPORT_VERIFY_FAILED", { logDetail: { reason: "codec mismatch", codec: metadata.video.codec } });
  if (metadata.video.width !== expected.width || metadata.video.height !== expected.height) {
    throw new AppError("EXPORT_VERIFY_FAILED", { logDetail: { reason: "size mismatch", got: [metadata.video.width, metadata.video.height], want: [expected.width, expected.height] } });
  }
  const tolerance = Math.max(0.5, 2 / expected.fps);
  if (Math.abs(metadata.video.durationSec - expected.durationSec) > tolerance) {
    throw new AppError("EXPORT_VERIFY_FAILED", { logDetail: { reason: "duration mismatch", got: metadata.video.durationSec, want: expected.durationSec } });
  }
  if (expected.hasAudio && !metadata.audio) throw new AppError("EXPORT_VERIFY_FAILED", { logDetail: { reason: "audio stream missing" } });
  return metadata;
}

async function moveIntoStorage(localPath: string, key: string): Promise<void> {
  const targetPath = getStorage().resolveLocalPath(key);
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  try {
    await fsp.rename(localPath, targetPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EXDEV") {
      await fsp.copyFile(localPath, targetPath);
      await fsp.rm(localPath, { force: true });
    } else {
      throw err;
    }
  }
}

function mapFailure(err: unknown): { code: ErrorCode; message: string } {
  if (err instanceof AppError) return { code: err.code, message: formatCatalogMessage(err.code, err.details) };
  if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
    return { code: "FFMPEG_NOT_FOUND", message: formatCatalogMessage("FFMPEG_NOT_FOUND") };
  }
  return { code: "INTERNAL_ERROR", message: formatCatalogMessage("INTERNAL_ERROR") };
}

/**
 * Never throws — every failure is recorded on the job row itself, so the
 * caller (jobs/runner.server.ts) can always safely `finally` on to the next queued job.
 */
export async function runExportJob(jobId: string, signal: AbortSignal): Promise<void> {
  const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const ctx = createJobContext(jobId, signal);
  let tempDir: string | null = null;
  let stderrText = () => "";
  let logKey: string | null = null;

  try {
    checkAborted(signal);

    // 1. Load
    const project = await prisma.project.findUnique({ where: { id: job.projectId }, include: { files: true } });
    if (!project) throw new AppError("PROJECT_NOT_FOUND");
    const videoFile = project.files.find((f) => f.role === "VIDEO");
    if (!videoFile) throw new AppError("ANALYSIS_REQUIRED");

    tempDir = exportTempDir(job.projectId, job.id);
    await fsp.mkdir(tempDir, { recursive: true });
    await prisma.renderJob.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: new Date(), phase: "PREPARING_TELEMETRY" } });

    // 2. Metadata
    const video = (project.videoMetadata as VideoMetadata | null) ?? (await probeVideo(getStorage().resolveLocalPath(videoFile.storageKey), videoFile.sizeBytes));
    const telemetrySummary = project.telemetrySummary as TelemetrySummary | null;
    if (!telemetrySummary) throw new AppError("ANALYSIS_REQUIRED");

    // 3. Validate
    const overlayConfig = parseOverlayConfig(job.overlaySnapshot);
    const telemetrySettings = parseTelemetrySettings(job.telemetrySettingsSnapshot);
    const settings = job.settings as unknown as ExportSettings;
    const outSize = computeOutputSize(video.video, settings.resolution);
    if ("error" in outSize) throw new AppError("RESOLUTION_UNAVAILABLE");
    const out = { width: outSize.width, height: outSize.height };

    // 4. Disk check (advisory only)
    try {
      const free = await statfsFree(getServerConfig().TEMP_PATH);
      if (free < Math.max(2 * GIB, 1.5 * video.sizeBytes)) ctx.addWarning("LOW_DISK_SPACE");
    } catch {
      // best-effort
    }

    checkAborted(signal);

    // 5. Telemetry
    const series = await loadTelemetrySeries(job.projectId);
    const interpolator = createInterpolator(series);
    const syncReport = project.syncReport as SyncReport | null;
    if (syncReport?.status === "NO_OVERLAP") ctx.addWarning("SYNC_NO_OVERLAP");

    // 6. GENERATING_FLIGHT_PATH
    await ctx.setPhase("GENERATING_FLIGHT_PATH");
    await ctx.setProgress(0.02);
    let flightPath: FlightPathGeoJson | null = null;
    try {
      flightPath = await loadFlightPath(job.projectId);
    } catch {
      flightPath = null;
    }

    const miniMapEl = overlayConfig.elements.find((e) => e.type === "miniMap");
    let basemapAsset: { image: CanvasImageSource; attribution: string } | null = null;
    if (miniMapEl?.visible && miniMapEl.type === "miniMap" && miniMapEl.basemap !== "none" && flightPath) {
      const pathFeature = flightPath.features.find((f) => f.properties.kind === "path");
      const bounds = pathFeature && pathFeature.geometry.type === "LineString" ? boundsOf(pathFeature.geometry.coordinates) : null;
      if (bounds) {
        const aspect = miniMapEl.width / miniMapEl.height;
        const viewport = fitViewport(bounds, aspect, miniMapEl.paddingRatio);
        const widthPx = Math.min(1024, Math.max(256, Math.round(miniMapEl.width * out.width)));
        const result = await renderBasemap(job.projectId, miniMapEl.basemap, viewport, widthPx);
        if (result) {
          const buf = await getStorage().readBuffer(result.key);
          basemapAsset = { image: (await loadImageFromBuffer(buf)) as unknown as CanvasImageSource, attribution: result.attribution };
        } else {
          ctx.addWarning("BASEMAP_UNAVAILABLE");
        }
      }
    }
    await ctx.setProgress(0.05);

    checkAborted(signal);

    // 7. RENDERING_OVERLAY
    await ctx.setPhase("RENDERING_OVERLAY");
    registerOverlayFonts();
    const logoEl = overlayConfig.elements.find((e) => e.type === "logo");
    let logoImage: CanvasImageSource | null = null;
    if (logoEl?.visible) {
      const logoFile = project.files.find((f) => f.role === "LOGO");
      if (logoFile) logoImage = (await loadImageFromBuffer(await getStorage().readBuffer(logoFile.storageKey))) as unknown as CanvasImageSource;
    }

    const rc: RenderContext = {
      frameWidth: out.width,
      frameHeight: out.height,
      unit: unitOf(out),
      config: overlayConfig,
      branding: { projectName: project.name, companyName: project.companyName },
      assets: { logo: logoImage, basemap: basemapAsset, flightPath, profile: buildProfile(series) },
    };

    const staticEls = overlayConfig.elements
      .filter((e) => e.visible && !isDynamic(e))
      .filter((e) => !(e.type === "logo" && !rc.assets.logo))
      .sort((a, b) => a.zIndex - b.zIndex);

    let staticPngPath: string | null = null;
    if (staticEls.length > 0) {
      const canvas = createCanvas(out.width, out.height);
      const cctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      for (const el of staticEls) {
        const r = toPixelRect(el, out);
        cctx.save();
        cctx.translate(r.x, r.y);
        cctx.beginPath();
        cctx.rect(0, 0, r.w, r.h);
        cctx.clip();
        cctx.globalAlpha = el.opacity;
        drawElement(cctx, el, r.w, r.h, rc, null);
        cctx.restore();
      }
      staticPngPath = path.join(tempDir, "static.png");
      await fsp.writeFile(staticPngPath, await canvas.encode("png"));
    }

    const dynamicEls = overlayConfig.elements.filter((e) => e.visible && isDynamic(e)).sort((a, b) => a.zIndex - b.zIndex);
    const atlas = buildAtlasLayout(dynamicEls, out);
    const elementsById = new Map<string, OverlayElement>(dynamicEls.map((e) => [e.id, e]));

    await ctx.setProgress(0.08);
    checkAborted(signal);

    // 8. ENCODING_VIDEO
    await ctx.setPhase("ENCODING_VIDEO");
    const expectedFrames = video.video.frameCount ?? Math.round(video.video.durationSec * video.video.fps.value);
    const framesToWrite = expectedFrames + Math.ceil(video.video.fps.value);
    await prisma.renderJob.update({ where: { id: jobId }, data: { framesTotal: expectedFrames } });

    const outputPath = path.join(tempDir, "output.mp4");
    const args = buildExportArgs({
      inputPath: getStorage().resolveLocalPath(videoFile.storageKey),
      staticPngPath,
      atlas,
      fps: video.video.fps,
      sourceStartTimeSec: video.video.startTimeSec,
      source: { width: video.video.width, height: video.video.height },
      output: out,
      audio: video.audio ? { codec: video.audio.codec } : null,
      quality: settings.quality,
      color: { primaries: video.video.colorPrimaries, transfer: video.video.colorTransfer, space: video.video.colorSpace },
      outputPath,
    });

    const proc = spawnFfmpeg(getServerConfig().FFMPEG_PATH, args, atlas !== null);
    const stderrRing = collectStderrRing(proc);
    stderrText = stderrRing.text;

    const onAbort = () => {
      void killFfmpeg(proc);
    };
    signal.addEventListener("abort", onAbort);

    const capabilities = telemetrySummary.capabilities;
    const frameAt = (videoTime: number): FrameState =>
      buildFrameState(videoTime, interpolator, telemetrySettings, { altitudeSource: overlayConfig.altitudeSource }, capabilities);

    let exitResult: { code: number | null; signal: NodeJS.Signals | null };
    try {
      const writerPromise = atlas
        ? writeAtlasFrames({ proc, atlas, elementsById, rc, fps: video.video.fps, framesToWrite, frameAt, signal, onFrame: () => {} })
        : Promise.resolve(0);

      const progressPromise = (async () => {
        const parser = new FfmpegProgressParser();
        proc.stdout.setEncoding("utf8");
        for await (const chunk of proc.stdout) {
          for (const p of parser.push(chunk as string)) {
            const f = video.video.durationSec > 0 ? Math.min(1, Math.max(0, (p.outTimeSec ?? 0) / video.video.durationSec)) : 0;
            await ctx.setProgress(0.08 + 0.89 * f, { done: p.frame ?? undefined, total: expectedFrames });
          }
        }
      })();

      [, , exitResult] = await Promise.all([writerPromise, progressPromise, proc.exited]);
    } finally {
      signal.removeEventListener("abort", onAbort);
    }

    checkAborted(signal);

    if (exitResult.code !== 0) {
      const tail = stderrText();
      if (tail.includes("No space left on device")) throw new AppError("EXPORT_DISK_FULL");
      logger.error("export", "ffmpeg exited non-zero", { jobId, code: exitResult.code, tail: tail.slice(-4000) });
      throw new AppError("EXPORT_FFMPEG_FAILED");
    }

    // 9. FINALIZING
    await ctx.setPhase("FINALIZING");
    await ctx.setProgress(0.97);
    const verified = await verifyOutput(outputPath, {
      width: out.width,
      height: out.height,
      durationSec: video.video.durationSec,
      fps: video.video.fps.value,
      hasAudio: video.audio !== null,
    });

    const fileName = `${slugify(project.name)}_telemetry.mp4`;
    const exportKey = keys.exportOutput(job.projectId, job.id, fileName);
    await moveIntoStorage(outputPath, exportKey);

    const outputFile = await prisma.storedFile.create({
      data: {
        projectId: job.projectId,
        role: "EXPORT",
        originalName: fileName,
        storageKey: exportKey,
        mimeType: "video/mp4",
        sizeBytes: verified.sizeBytes,
      },
    });

    await prisma.renderJob.update({
      where: { id: jobId },
      data: { status: "COMPLETE", progress: 1, framesDone: expectedFrames, finishedAt: new Date(), outputFileId: outputFile.id, warnings: toJson(ctx.warnings) },
    });
    void notifyExportFinished(jobId);
  } catch (err) {
    if (err instanceof CancelledError || signal.aborted) {
      await prisma.renderJob
        .update({
          where: { id: jobId },
          data: { status: "CANCELLED", finishedAt: new Date(), errorCode: "EXPORT_CANCELLED", errorMessage: formatCatalogMessage("EXPORT_CANCELLED"), warnings: toJson(ctx.warnings) },
        })
        .catch(() => {});
    } else {
      const mapped = mapFailure(err);
      logger.error("export", "export job failed", { jobId, code: mapped.code, err: { message: err instanceof Error ? err.message : String(err) } });
      await prisma.renderJob
        .update({
          where: { id: jobId },
          data: { status: "FAILED", finishedAt: new Date(), errorCode: mapped.code, errorMessage: mapped.message, warnings: toJson(ctx.warnings) },
        })
        .catch(() => {});
      void notifyExportFinished(jobId);
    }
  } finally {
    if (stderrText().trim()) {
      logKey = keys.exportLog(job.projectId, job.id);
      await getStorage()
        .save(logKey, stderrText())
        .then(() => prisma.renderJob.update({ where: { id: jobId }, data: { logKey } }))
        .catch(() => {});
    }
    if (tempDir) {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      await fsp.rmdir(path.dirname(tempDir)).catch(() => {});
    }
  }
}
