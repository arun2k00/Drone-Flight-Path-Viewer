import { requireJobAccess } from "@/lib/auth/session.server";
import { prisma } from "@/lib/db.server";
import { AppError } from "@/lib/errors/app-error";
import { runRoute } from "@/lib/errors/route.server";
import { getJobOrThrow } from "@/lib/jobs/service.server";
import { getStorage } from "@/lib/storage/index.server";
import { fileResponse } from "@/lib/video/file-response.server";

/** Range-supported download of the finished export. */
export async function GET(req: Request, ctx: RouteContext<"/api/jobs/[jobId]/download">) {
  return runRoute(async () => {
    const jobId = await requireJobAccess((await ctx.params).jobId);
    const job = await getJobOrThrow(jobId);
    if (job.status !== "COMPLETE" || !job.outputFileId) throw new AppError("EXPORT_NOT_READY");

    const outputFile = await prisma.storedFile.findUnique({ where: { id: job.outputFileId } });
    if (!outputFile) throw new AppError("EXPORT_NOT_READY");

    const localPath = getStorage().resolveLocalPath(outputFile.storageKey);
    return fileResponse(req, localPath, { contentType: "video/mp4", downloadName: outputFile.originalName });
  });
}
