import { requireProjectAccess } from "@/lib/auth/session.server";
import { AppError } from "@/lib/errors/app-error";
import { runRoute } from "@/lib/errors/route.server";
import { contentDisposition } from "@/lib/format/content-disposition";
import { slugify } from "@/lib/format/slug";
import { buildFlightPathGeoJson, extractGpsTrack } from "@/lib/map/geojson";
import { getProjectOrThrow } from "@/lib/projects/service.server";
import { loadTelemetrySeries } from "@/lib/telemetry/persistence.server";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[projectId]/flight-path/download">) {
  return runRoute(async () => {
    const projectId = await requireProjectAccess((await ctx.params).projectId);
    const project = await getProjectOrThrow(projectId);
    const series = await loadTelemetrySeries(projectId); // throws ANALYSIS_REQUIRED if not yet analyzed

    const points = Array.from({ length: series.length }, (_, i) => ({
      latitude: Number.isNaN(series.latitude[i]) ? null : series.latitude[i],
      longitude: Number.isNaN(series.longitude[i]) ? null : series.longitude[i],
      timestamp: series.t[i],
    }));
    const track = extractGpsTrack(points);
    if (track.coords.length === 0) throw new AppError("TELEMETRY_NO_GPS");

    const flightPath = buildFlightPathGeoJson(track, { simplify: false });
    const fileName = `${slugify(project.name)}_flight_path.geojson`;

    return new Response(JSON.stringify(flightPath), {
      headers: {
        "Content-Type": "application/geo+json",
        "Content-Disposition": contentDisposition(fileName),
      },
    });
  });
}
