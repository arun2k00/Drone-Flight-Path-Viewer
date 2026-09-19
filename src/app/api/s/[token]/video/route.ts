import { AppError } from "@/lib/errors/app-error";
import { runRoute } from "@/lib/errors/route.server";
import { resolveShare } from "@/lib/share/service.server";
import { getStorage } from "@/lib/storage/index.server";
import { fileResponse } from "@/lib/video/file-response.server";

/** Public, token-gated: the original video, streamed with Range support for the share page player. */
export async function GET(req: Request, ctx: RouteContext<"/api/s/[token]/video">) {
  return runRoute(async () => {
    const link = await resolveShare((await ctx.params).token);
    const file = link.project.files.find((f) => f.role === "VIDEO");
    if (!file) throw new AppError("FILE_NOT_FOUND");
    return fileResponse(req, getStorage().resolveLocalPath(file.storageKey), { contentType: file.mimeType });
  });
}
