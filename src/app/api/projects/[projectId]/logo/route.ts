import { requireProjectAccess } from "@/lib/auth/session.server";
import { AppError } from "@/lib/errors/app-error";
import { runRoute } from "@/lib/errors/route.server";
import { getProjectOrThrow, removeLogo } from "@/lib/projects/service.server";
import { getStorage } from "@/lib/storage/index.server";

export async function GET(_req: Request, routeCtx: RouteContext<"/api/projects/[projectId]/logo">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await routeCtx.params).projectId);
    const project = await getProjectOrThrow(projectId);
    const logoFile = project.files.find((f) => f.role === "LOGO");
    if (!logoFile) throw new AppError("FILE_NOT_FOUND");

    const png = await getStorage().readBuffer(logoFile.storageKey);
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" } });
  });
}

export async function DELETE(_req: Request, routeCtx: RouteContext<"/api/projects/[projectId]/logo">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await routeCtx.params).projectId);
    await removeLogo(projectId);
    return new Response(null, { status: 204 });
  });
}
