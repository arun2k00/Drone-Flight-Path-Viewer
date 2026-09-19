import { requireUploadAccess } from "@/lib/auth/session.server";
import { AppError } from "@/lib/errors/app-error";
import { runRoute } from "@/lib/errors/route.server";
import { deleteUpload, getUploadSession, putChunk } from "@/lib/uploads/service.server";

export async function GET(_req: Request, ctx: RouteContext<"/api/uploads/[uploadId]">) {
  return runRoute(async () => {
    const uploadId = await requireUploadAccess((await ctx.params).uploadId);
    const upload = await getUploadSession(uploadId);
    return Response.json({ upload });
  });
}

export async function PUT(req: Request, ctx: RouteContext<"/api/uploads/[uploadId]">) {
  return runRoute(async () => {
    const uploadId = await requireUploadAccess((await ctx.params).uploadId);

    const offset = Number(new URL(req.url).searchParams.get("offset"));
    if (!Number.isFinite(offset) || offset < 0) {
      throw new AppError("VALIDATION_FAILED", {
        details: { issues: [{ path: "offset", message: "offset must be a non-negative integer." }] },
      });
    }
    if (!req.body) {
      throw new AppError("VALIDATION_FAILED", { details: { issues: [{ path: "body", message: "Request body is required." }] } });
    }

    const contentLengthHeader = req.headers.get("content-length");
    const contentLength = contentLengthHeader !== null ? Number(contentLengthHeader) : null;
    const receivedBytes = await putChunk(
      uploadId,
      offset,
      contentLength !== null && Number.isFinite(contentLength) ? contentLength : null,
      req.body,
    );
    return Response.json({ receivedBytes });
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/uploads/[uploadId]">) {
  return runRoute(async () => {
    const uploadId = await requireUploadAccess((await ctx.params).uploadId);
    await deleteUpload(uploadId);
    return new Response(null, { status: 204 });
  });
}
