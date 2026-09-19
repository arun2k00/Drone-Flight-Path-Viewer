import { logActivity } from "@/lib/activity.server";
import { requireProjectAccess, requireUser } from "@/lib/auth/session.server";
import { z } from "zod";
import { parseBody, runRoute } from "@/lib/errors/route.server";
import { createExportJob, listExportJobs } from "@/lib/jobs/service.server";
import { overlayConfigSchema } from "@/lib/overlay/model";

const exportSettingsSchema = z.object({
  resolution: z.enum(["original", "1080p", "2160p"]),
  quality: z.enum(["high", "balanced", "small"]),
});

const createExportSchema = z.object({
  overlayConfig: overlayConfigSchema,
  settings: exportSettingsSchema,
});

export async function POST(req: Request, ctx: RouteContext<"/api/projects/[projectId]/exports">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    const body = parseBody(createExportSchema, await req.json());
    const job = await createExportJob(projectId, body.overlayConfig, body.settings);
    await logActivity((await requireUser()).id, "export.start", `${body.settings.resolution} · ${body.settings.quality}`);
    return Response.json({ job }, { status: 202 });
  });
}

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[projectId]/exports">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    const jobs = await listExportJobs(projectId);
    return Response.json({ jobs });
  });
}
