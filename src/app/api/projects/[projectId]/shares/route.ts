import { requireProjectAccess, requireUser } from "@/lib/auth/session.server";
import { rateLimit } from "@/lib/auth/rate-limit.server";
import { parseBody, runRoute } from "@/lib/errors/route.server";
import { createShareLink, createShareSchema, listShareLinks } from "@/lib/share/service.server";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[projectId]/shares">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    return Response.json({ links: await listShareLinks(projectId) });
  });
}

export async function POST(req: Request, ctx: RouteContext<"/api/projects/[projectId]/shares">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    const user = await requireUser();
    rateLimit(`share:${user.id}`, 30, 60 * 60_000); // also caps outgoing client emails
    const body = parseBody(createShareSchema, await req.json());
    return Response.json({ link: await createShareLink(projectId, user, body) }, { status: 201 });
  });
}
