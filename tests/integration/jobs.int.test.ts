import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db.server";
import { cancelJob } from "@/lib/jobs/service.server";
import { createProject } from "@/lib/projects/service.server";

describe("cancelJob", () => {
  afterEach(() => vi.restoreAllMocks());

  it("doesn't turn an export that finished while the cancel was in flight into CANCELLED", async () => {
    const project = await createProject({ name: "Cancel race" });
    const job = await prisma.renderJob.create({
      data: { projectId: project.id, status: "COMPLETE", progress: 1, finishedAt: new Date(), settings: { resolution: "original", quality: "high" }, overlaySnapshot: {}, telemetrySettingsSnapshot: {} },
    });
    // cancelJob read the job while it was still running; it completed before the cancel was written.
    vi.spyOn(prisma.renderJob, "findUnique").mockResolvedValueOnce({ ...job, status: "RUNNING", finishedAt: null } as never);

    await cancelJob(job.id);
    expect((await prisma.renderJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("COMPLETE");
  });
});
