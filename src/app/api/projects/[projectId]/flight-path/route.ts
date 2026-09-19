import { requireProjectAccess } from "@/lib/auth/session.server";
import { runRoute } from "@/lib/errors/route.server";
import { loadFlightPath } from "@/lib/telemetry/persistence.server";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[projectId]/flight-path">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    const flightPath = await loadFlightPath(projectId);
    return Response.json(flightPath);
  });
}
