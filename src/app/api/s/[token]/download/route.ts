import { prisma } from "@/lib/db.server";
import { AppError } from "@/lib/errors/app-error";
import { runRoute } from "@/lib/errors/route.server";
import { resolveShare } from "@/lib/share/service.server";
import { getStorage } from "@/lib/storage/index.server";
import { fileResponse } from "@/lib/video/file-response.server";

/** Public, token-gated: the latest finished export (widgets burned in), if the owner allowed downloads. */
export async function GET(req: Request, ctx: RouteContext<"/api/s/[token]/download">) {
  return runRoute(async () => {
    const link = await resolveShare((await ctx.params).token);
    const job = link.project.jobs[0];
    if (!link.allowDownload || !job?.outputFileId) throw new AppError("EXPORT_NOT_READY");
    const file = await prisma.storedFile.findUnique({ where: { id: job.outputFileId } });
    if (!file) throw new AppError("EXPORT_NOT_READY");
    return fileResponse(req, getStorage().resolveLocalPath(file.storageKey), { contentType: "video/mp4", downloadName: file.originalName });
  });
}
