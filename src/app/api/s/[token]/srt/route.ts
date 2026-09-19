import { AppError } from "@/lib/errors/app-error";
import { runRoute } from "@/lib/errors/route.server";
import { resolveShare } from "@/lib/share/service.server";
import { getStorage } from "@/lib/storage/index.server";

/** Public, token-gated: the flight log. The share page parses it in the browser with the same parser as /viewer. */
export async function GET(_req: Request, ctx: RouteContext<"/api/s/[token]/srt">) {
  return runRoute(async () => {
    const link = await resolveShare((await ctx.params).token);
    const file = link.project.files.find((f) => f.role === "TELEMETRY");
    if (!file) throw new AppError("FILE_NOT_FOUND");
    const bytes = await getStorage().readBuffer(file.storageKey);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/x-subrip", "Cache-Control": "private, no-store" } });
  });
}
