import { requireProjectAccess } from "@/lib/auth/session.server";
import { z } from "zod";
import { parseBody, runRoute } from "@/lib/errors/route.server";
import { initUpload } from "@/lib/uploads/service.server";

const initUploadSchema = z.object({
  role: z.enum(["VIDEO", "TELEMETRY", "LOGO"]),
  fileName: z.string().min(1).max(1024),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string().min(1).max(255),
});

export async function POST(req: Request, ctx: RouteContext<"/api/projects/[projectId]/uploads">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    const body = parseBody(initUploadSchema, await req.json());
    const upload = await initUpload(projectId, body);
    return Response.json({ upload }, { status: 201 });
  });
}
