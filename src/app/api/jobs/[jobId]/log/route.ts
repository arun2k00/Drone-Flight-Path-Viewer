import { requireJobAccess } from "@/lib/auth/session.server";
import { getPublicConfig } from "@/lib/config/public-config.server";
import { runRoute } from "@/lib/errors/route.server";
import { getJobOrThrow } from "@/lib/jobs/service.server";
import { getStorage } from "@/lib/storage/index.server";

/** raw FFmpeg stderr never reaches the client except via this diagnostics-gated route. */
export async function GET(_req: Request, ctx: RouteContext<"/api/jobs/[jobId]/log">) {
  return runRoute(async () => {
    if (!getPublicConfig().diagnosticsEnabled) return new Response(null, { status: 404 });

    const jobId = await requireJobAccess((await ctx.params).jobId);
    const job = await getJobOrThrow(jobId);
    if (!job.logKey) return new Response(null, { status: 404 });

    const bytes = await getStorage().readBuffer(job.logKey);
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="ffmpeg.log"', "Cache-Control": "no-store" },
    });
  });
}
