import { requireProjectAccess } from "@/lib/auth/session.server";
import { AppError } from "@/lib/errors/app-error";
import { runRoute } from "@/lib/errors/route.server";
import { getProjectOrThrow } from "@/lib/projects/service.server";
import { getStorage } from "@/lib/storage/index.server";
import { fileResponse } from "@/lib/video/file-response.server";

export async function GET(req: Request, ctx: RouteContext<"/api/projects/[projectId]/video">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    const project = await getProjectOrThrow(projectId);
    const videoFile = project.files.find((f) => f.role === "VIDEO");
    if (!videoFile) throw new AppError("FILE_NOT_FOUND");

    const localPath = getStorage().resolveLocalPath(videoFile.storageKey);
    return fileResponse(req, localPath, { contentType: videoFile.mimeType });
  });
}
