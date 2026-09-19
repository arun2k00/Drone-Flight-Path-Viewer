import { requireUploadAccess } from "@/lib/auth/session.server";
import { runRoute } from "@/lib/errors/route.server";
import { completeUpload } from "@/lib/uploads/service.server";

export async function POST(_req: Request, ctx: RouteContext<"/api/uploads/[uploadId]/complete">) {
  return runRoute(async () => {
    const uploadId = await requireUploadAccess((await ctx.params).uploadId);
    const file = await completeUpload(uploadId);
    return Response.json({ file });
  });
}
