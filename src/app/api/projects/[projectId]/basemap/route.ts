import { requireProjectAccess } from "@/lib/auth/session.server";
import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import { parseBody, runRoute } from "@/lib/errors/route.server";
import { basemapTemplateUrl, renderBasemap } from "@/lib/map/basemap.server";
import { boundsOf } from "@/lib/map/geojson";
import { fitViewport } from "@/lib/map/projection";
import { loadFlightPath } from "@/lib/telemetry/persistence.server";
import { getStorage } from "@/lib/storage/index.server";

const querySchema = z.object({
  style: z.enum(["map", "satellite"]),
  aspect: z.coerce.number().min(0.1).max(10),
  width: z.coerce.number().int().min(256).max(1024),
  padding: z.coerce.number().min(0).max(0.3).default(0.12),
});

/** Preview basemap for the editor's mini-map. Serves the same cached PNG the export would use. */
export async function GET(req: Request, routeCtx: RouteContext<"/api/projects/[projectId]/basemap">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await routeCtx.params).projectId);
    const url = new URL(req.url);
    const { style, aspect, width, padding } = parseBody(querySchema, {
      style: url.searchParams.get("style"),
      aspect: url.searchParams.get("aspect"),
      width: url.searchParams.get("width"),
      padding: url.searchParams.get("padding") ?? undefined,
    });

    if (!basemapTemplateUrl(style)) throw new AppError("BASEMAP_NOT_CONFIGURED");

    const flightPath = await loadFlightPath(projectId);
    const pathFeature = flightPath.features.find((f) => f.properties.kind === "path");
    const bounds = pathFeature && pathFeature.geometry.type === "LineString" ? boundsOf(pathFeature.geometry.coordinates) : null;
    if (!bounds) throw new AppError("BASEMAP_UNAVAILABLE", { logDetail: { reason: "no flight path bounds" } });

    const viewport = fitViewport(bounds, aspect, padding);
    const result = await renderBasemap(projectId, style, viewport, width);
    if (!result) throw new AppError("BASEMAP_UNAVAILABLE", { logDetail: { reason: "tile fetch failed" } });

    const png = await getStorage().readBuffer(result.key);
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Basemap-Attribution": encodeURIComponent(result.attribution),
      },
    });
  });
}
