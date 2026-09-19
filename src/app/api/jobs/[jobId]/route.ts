import { requireJobAccess } from "@/lib/auth/session.server";
import { runRoute } from "@/lib/errors/route.server";
import { cancelJob, getJobDto } from "@/lib/jobs/service.server";

export async function GET(_req: Request, ctx: RouteContext<"/api/jobs/[jobId]">) {
  return runRoute(async () => {
    const jobId = await requireJobAccess((await ctx.params).jobId);
    const job = await getJobDto(jobId);
    return Response.json({ job });
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/jobs/[jobId]">) {
  return runRoute(async () => {
    const jobId = await requireJobAccess((await ctx.params).jobId);
    const job = await cancelJob(jobId);
    return Response.json({ job }, { status: 202 });
  });
}
