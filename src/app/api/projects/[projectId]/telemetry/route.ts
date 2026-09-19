import { requireProjectAccess } from "@/lib/auth/session.server";
import { runRoute } from "@/lib/errors/route.server";
import { loadTelemetryPayload } from "@/lib/telemetry/persistence.server";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[projectId]/telemetry">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    const payload = await loadTelemetryPayload(projectId);
    return Response.json(payload);
  });
}
