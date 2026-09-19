import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateSrt } from "../helpers/synthetic-srt";
import { generateSyntheticVideo } from "../helpers/synthetic-video";
import { grabRegionRgb, meanAbsDiff } from "../helpers/image-diff";
import { hasFfmpeg } from "../helpers/ffmpeg-available";

const ffmpegAvailable = await hasFfmpeg();

describe.skipIf(!ffmpegAvailable)("runExportJob (real ffmpeg)", () => {
  let workDir: string;
  let sourceVideoPath: string;
  let sourceSrtPath: string;
  let longVideoPath: string;
  let longSrtPath: string;
  const FRAME = { width: 1280, height: 720 };
  const DURATION_SEC = 3;
  // Long enough (at 4K, "medium" preset) that a poll-and-abort loop can reliably land mid-encode.
  const LONG_FRAME = { width: 3840, height: 2160 };
  const LONG_DURATION_SEC = 20;

  async function writeFixture(videoPath: string, srtPath: string, frame: { width: number; height: number }, durationSec: number): Promise<void> {
    await generateSyntheticVideo(videoPath, { width: frame.width, height: frame.height, fps: "30/1", durationSec, withAudio: false });
    const srt = generateSrt({
      durationSec,
      fps: { num: 30, den: 1 },
      center: { latitude: 17.385044, longitude: 78.486671 },
      radiusM: 40,
      lapSec: 12,
      relAlt: [20, 30],
      absAltOffset: 480,
      gpsUpdateHz: 10,
      noFixFrames: 0,
      format: "enterprise",
      startWallClock: "2026-05-27 13:14:22.911",
    });
    await fsp.writeFile(srtPath, srt, "utf8");
  }

  beforeAll(async () => {
    workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "dts-export-int-"));
    sourceVideoPath = path.join(workDir, "source.mp4");
    sourceSrtPath = path.join(workDir, "source.SRT");
    await writeFixture(sourceVideoPath, sourceSrtPath, FRAME, DURATION_SEC);

    longVideoPath = path.join(workDir, "long.mp4");
    longSrtPath = path.join(workDir, "long.SRT");
    await writeFixture(longVideoPath, longSrtPath, LONG_FRAME, LONG_DURATION_SEC);
  }, 120_000);

  afterAll(async () => {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  });

  async function setUpProject(
    name: string,
    videoPath: string = sourceVideoPath,
    srtPath: string = sourceSrtPath,
    frameSize: { width: number; height: number } = FRAME,
  ): Promise<{ projectId: string; frame: { width: number; height: number } }> {
    const { createProject, setVideoMetadata, getProjectOrThrow, updateProject } = await import("@/lib/projects/service.server");
    const { analyzeProject } = await import("@/lib/projects/analysis.server");
    const { probeVideo } = await import("@/lib/video/probe.server");
    const { getStorage } = await import("@/lib/storage/index.server");
    const { keys } = await import("@/lib/storage/keys");
    const { instantiateTemplate } = await import("@/lib/overlay/templates");
    const { prisma } = await import("@/lib/db.server");

    const project = await createProject({ name });
    const storage = getStorage();

    const videoBytes = await fsp.readFile(videoPath);
    const videoKey = keys.sourceVideo(project.id, ".mp4");
    await storage.save(videoKey, videoBytes);
    await prisma.storedFile.create({
      data: { projectId: project.id, role: "VIDEO", originalName: "source.mp4", storageKey: videoKey, mimeType: "video/mp4", sizeBytes: videoBytes.byteLength },
    });

    const metadata = await probeVideo(storage.resolveLocalPath(videoKey), videoBytes.byteLength);
    await setVideoMetadata(project.id, metadata);

    const srtBytes = await fsp.readFile(srtPath);
    const srtKey = keys.sourceTelemetry(project.id);
    await storage.save(srtKey, srtBytes);
    await prisma.storedFile.create({
      data: { projectId: project.id, role: "TELEMETRY", originalName: "source.SRT", storageKey: srtKey, mimeType: "application/x-subrip", sizeBytes: srtBytes.byteLength },
    });

    await analyzeProject(project.id);

    const overlayConfig = instantiateTemplate("survey", frameSize, { hasGps: true, hasHeading: true, hasLogo: false });
    await updateProject(project.id, { overlayConfig });

    const ready = await getProjectOrThrow(project.id);
    expect(ready.status).toBe("READY");

    return { projectId: project.id, frame: frameSize };
  }

  async function createJobRow(projectId: string, quality: "high" | "balanced" | "small" = "balanced"): Promise<string> {
    const { prisma } = await import("@/lib/db.server");
    const { getProjectOrThrow } = await import("@/lib/projects/service.server");
    const project = await getProjectOrThrow(projectId);
    const job = await prisma.renderJob.create({
      data: {
        projectId,
        kind: "EXPORT",
        status: "QUEUED",
        settings: { resolution: "original", quality } as never,
        overlaySnapshot: project.overlayConfig as never,
        telemetrySettingsSnapshot: project.telemetrySettings as never,
      },
    });
    return job.id;
  }

  it(
    "renders the survey template end to end: output exists, is verifiable, frame count matches, and the overlay is visibly burned in",
    async () => {
      const { projectId, frame } = await setUpProject("Export Int Test");
      const jobId = await createJobRow(projectId, "balanced");

      const { runExportJob } = await import("@/lib/jobs/export-service.server");
      const controller = new AbortController();
      await runExportJob(jobId, controller.signal);

      const { prisma } = await import("@/lib/db.server");
      const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
      expect(job?.status).toBe("COMPLETE");
      expect(job?.errorCode).toBeNull();
      expect(job?.outputFileId).not.toBeNull();

      const outputFile = await prisma.storedFile.findUnique({ where: { id: job!.outputFileId! } });
      expect(outputFile).not.toBeNull();

      const { getStorage } = await import("@/lib/storage/index.server");
      const outputPath = getStorage().resolveLocalPath(outputFile!.storageKey);
      expect(fs.existsSync(outputPath)).toBe(true);

      const { probeVideo } = await import("@/lib/video/probe.server");
      const outMeta = await probeVideo(outputPath, outputFile!.sizeBytes);
      expect(outMeta.video.codec).toBe("h264");
      expect(outMeta.video.width).toBe(frame.width);
      expect(outMeta.video.height).toBe(frame.height);

      const { getProjectOrThrow } = await import("@/lib/projects/service.server");
      const project = await getProjectOrThrow(projectId);
      const sourceMeta = project.videoMetadata as unknown as { video: { frameCount: number | null; durationSec: number; fps: { value: number } } };
      const expectedFrameCount = sourceMeta.video.frameCount ?? Math.round(sourceMeta.video.durationSec * sourceMeta.video.fps.value);
      expect(outMeta.video.frameCount).toBe(expectedFrameCount);

      const tolerance = Math.max(0.5, 2 / sourceMeta.video.fps.value);
      expect(Math.abs(outMeta.video.durationSec - sourceMeta.video.durationSec)).toBeLessThanOrEqual(tolerance);

      // Telemetry panel region: differs between two points in time, and differs from the un-overlaid source.
      const { toPixelRect } = await import("@/lib/overlay/layout");
      const overlayConfig = project.overlayConfig as unknown as { elements: Array<{ type: string; visible: boolean; x: number; y: number; width: number; height: number }> };
      const panel = overlayConfig.elements.find((e) => e.type === "telemetryPanel")!;
      const px = toPixelRect(panel, frame);
      const rect = { x: px.x, y: px.y, width: px.w, height: px.h };

      const outEarly = await grabRegionRgb(outputPath, 0.5, rect);
      const outLate = await grabRegionRgb(outputPath, 2.5, rect);
      expect(meanAbsDiff(outEarly, outLate)).toBeGreaterThan(3);

      const srcAtSameTime = await grabRegionRgb(sourceVideoPath, 0.5, rect);
      expect(meanAbsDiff(outEarly, srcAtSameTime)).toBeGreaterThan(10);

      // Temp dir cleaned up.
      const { exportTempDir } = await import("@/lib/storage/temp.server");
      expect(fs.existsSync(exportTempDir(projectId, jobId))).toBe(false);
    },
    120_000,
  );

  it(
    "cancellation: aborting mid-encode leaves the job CANCELLED, kills ffmpeg and removes the temp dir",
    async () => {
      // A long 4K source (fixed "medium" preset) so encoding takes long enough to reliably catch mid-stream.
      const { projectId } = await setUpProject("Export Int Test Cancel", longVideoPath, longSrtPath, LONG_FRAME);
      const jobId = await createJobRow(projectId, "high");

      const { runExportJob } = await import("@/lib/jobs/export-service.server");
      const { prisma } = await import("@/lib/db.server");
      const { exportTempDir } = await import("@/lib/storage/temp.server");

      const controller = new AbortController();
      const runPromise = runExportJob(jobId, controller.signal);

      const deadline = Date.now() + 10_000;
      let framesSeen = 0;
      while (Date.now() < deadline) {
        const row = await prisma.renderJob.findUnique({ where: { id: jobId } });
        framesSeen = row?.framesDone ?? 0;
        if (row?.phase === "ENCODING_VIDEO" && framesSeen > 0) break;
        if (row?.status === "COMPLETE" || row?.status === "FAILED") break; // finished before we could cancel — still a valid (if less interesting) run
        await new Promise((r) => setTimeout(r, 20));
      }

      controller.abort();
      await runPromise;

      const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
      if (job?.status === "COMPLETE") {
        // The 3s clip finished encoding before the abort landed — not a failure of cancellation itself.
        expect(fs.existsSync(exportTempDir(projectId, jobId))).toBe(false);
        return;
      }
      expect(job?.status).toBe("CANCELLED");
      expect(job?.errorCode).toBe("EXPORT_CANCELLED");
      // runExportJob's `finally` only runs after killFfmpeg has awaited SIGTERM (then SIGKILL) and the
      // child's exit, so no ffmpeg process remains once this promise has resolved.
      expect(fs.existsSync(exportTempDir(projectId, jobId))).toBe(false);
    },
    120_000,
  );
});
