import { requireProjectAccess } from "@/lib/auth/session.server";
import { getPublicConfig } from "@/lib/config/public-config.server";
import { runRoute } from "@/lib/errors/route.server";
import { loadDebugRecords } from "@/lib/telemetry/persistence.server";

export async function GET(req: Request, ctx: RouteContext<"/api/projects/[projectId]/telemetry/debug">) {
  return runRoute(async () => {
    if (!getPublicConfig().diagnosticsEnabled) return new Response(null, { status: 404 });

    const projectId = await requireProjectAccess((await ctx.params).projectId);
    const url = new URL(req.url);
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0") || 0);
    const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") ?? "200") || 200));
    const { total, records } = await loadDebugRecords(projectId, offset, limit);
    return Response.json({ total, records });
  });
}
