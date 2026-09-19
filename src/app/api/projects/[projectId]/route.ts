import { logActivity } from "@/lib/activity.server";
import { requireProjectAccess, requireUser } from "@/lib/auth/session.server";
import { z } from "zod";
import { parseBody, runRoute } from "@/lib/errors/route.server";
import { overlayConfigSchema } from "@/lib/overlay/model";
import { deleteProject, getProjectDto, updateProject } from "@/lib/projects/service.server";

const patchProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  companyName: z.string().max(120).nullable().optional(),
  telemetrySettings: z
    .object({
      offsetSec: z.number().min(-30).max(30).optional(),
      speedSource: z.enum(["auto", "srt-only"]).optional(),
      headingFallback: z.enum(["none", "gps-course"]).optional(),
      coordinateOrder: z.enum(["auto", "lat-lon", "lon-lat"]).optional(),
    })
    .optional(),
  overlayConfig: overlayConfigSchema.optional(),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[projectId]">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    const project = await getProjectDto(projectId);
    return Response.json({ project });
  });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/projects/[projectId]">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    const body = parseBody(patchProjectSchema, await req.json());
    const project = await updateProject(projectId, body);
    return Response.json({ project });
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[projectId]">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    await deleteProject(projectId);
    await logActivity((await requireUser()).id, "project.delete", projectId);
    return new Response(null, { status: 204 });
  });
}
