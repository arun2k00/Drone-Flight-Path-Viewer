import fsp from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db.server";
import { AppError } from "@/lib/errors/app-error";
import { analyzeProject } from "@/lib/projects/analysis.server";
import { createProject } from "@/lib/projects/service.server";
import { getStorage } from "@/lib/storage/index.server";
import { keys } from "@/lib/storage/keys";
import { loadFlightPath } from "@/lib/telemetry/persistence.server";

describe("analyzeProject", () => {
  it("re-analysis with an SRT that has no GPS drops the previous flight path", async () => {
    const project = await createProject({ name: "Re-analysis" });
    const storage = getStorage();
    const srtKey = keys.sourceTelemetry(project.id);
    // Analysis reuses the metadata probed at upload, so the video file itself is never read here.
    await prisma.project.update({ where: { id: project.id }, data: { videoMetadata: { video: { durationSec: 10, fps: { value: 25 }, frameCount: 250 } } } });
    await prisma.storedFile.createMany({
      data: [
        { projectId: project.id, role: "VIDEO", originalName: "v.mp4", storageKey: keys.sourceVideo(project.id, ".mp4"), mimeType: "video/mp4", sizeBytes: 1 },
        { projectId: project.id, role: "TELEMETRY", originalName: "t.srt", storageKey: srtKey, mimeType: "application/x-subrip", sizeBytes: 1 },
      ],
    });

    await storage.save(srtKey, await fsp.readFile("tests/fixtures/srt/dji-air3s-25fps.SRT"));
    expect((await analyzeProject(project.id)).telemetrySummary?.capabilities.gps).toBe(true);
    await expect(loadFlightPath(project.id)).resolves.toBeTruthy();

    await storage.save(srtKey, await fsp.readFile("tests/fixtures/srt/missing-gps.SRT"));
    expect((await analyzeProject(project.id)).telemetrySummary?.capabilities.gps).toBe(false);
    const err = await loadFlightPath(project.id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("TELEMETRY_NO_GPS");
  });
});
