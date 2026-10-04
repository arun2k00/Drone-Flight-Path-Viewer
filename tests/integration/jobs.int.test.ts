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
    const findUnique = prisma.renderJob.findUnique.bind(prisma.renderJob);
    vi.spyOn(prisma.renderJob, "findUnique").mockImplementationOnce(((args: Parameters<typeof findUnique>[0]) =>
      findUnique(args).then((row) => row && { ...row, status: "RUNNING", finishedAt: null })) as typeof prisma.renderJob.findUnique);

    await cancelJob(job.id);
    expect((await prisma.renderJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("COMPLETE");
  });
});
