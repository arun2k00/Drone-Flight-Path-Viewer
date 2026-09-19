import { requireProjectAccess } from "@/lib/auth/session.server";
import { runRoute } from "@/lib/errors/route.server";
import { analyzeProject } from "@/lib/projects/analysis.server";

export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[projectId]/analyze">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    const project = await analyzeProject(projectId);
    return Response.json({ project });
  });
}
