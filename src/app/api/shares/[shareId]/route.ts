import { requireUser } from "@/lib/auth/session.server";
import { runRoute } from "@/lib/errors/route.server";
import { parseUuidParam } from "@/lib/ids";
import { revokeShareLink } from "@/lib/share/service.server";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/shares/[shareId]">) {
  return runRoute(async () => {
    const shareId = parseUuidParam((await ctx.params).shareId, "SHARE_NOT_FOUND");
    await revokeShareLink(shareId, await requireUser());
    return new Response(null, { status: 204 });
  });
}
