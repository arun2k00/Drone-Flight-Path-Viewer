import { requireProjectAccess } from "@/lib/auth/session.server";
import { createCanvas } from "@napi-rs/canvas";
import { z } from "zod";
import { getPublicConfig } from "@/lib/config/public-config.server";
import { AppError } from "@/lib/errors/app-error";
import { parseBody, runRoute } from "@/lib/errors/route.server";
import { registerOverlayFonts, loadImageFromBuffer } from "@/lib/overlay/assets.server";
import { buildFrameState } from "@/lib/overlay/frame-state";
import { unitOf } from "@/lib/overlay/layout";
import { drawFullFrame, type RenderContext } from "@/lib/overlay/render";
import { getProjectDto, getProjectOrThrow } from "@/lib/projects/service.server";
import { getStorage } from "@/lib/storage/index.server";
import { createInterpolator } from "@/lib/telemetry/interpolator";
import { loadFlightPath, loadTelemetrySeries } from "@/lib/telemetry/persistence.server";
import { buildProfile } from "@/lib/telemetry/profile";
import { grabFramePng } from "@/lib/video/frame-grab.server";

const querySchema = z.object({
  t: z.coerce.number().min(0),
  scale: z.coerce.number().min(0.25).max(1).default(1),
});

/** Diagnostics-only parity check: pause the preview at t, screenshot, and compare against this PNG. */
export async function GET(req: Request, routeCtx: RouteContext<"/api/projects/[projectId]/render-frame">) {
  return runRoute(async () => {
    if (!getPublicConfig().diagnosticsEnabled) return new Response(null, { status: 404 });

    const projectId = await requireProjectAccess((await routeCtx.params).projectId);
    const url = new URL(req.url);
    const { t, scale } = parseBody(querySchema, { t: url.searchParams.get("t"), scale: url.searchParams.get("scale") ?? undefined });

    const [project, projectRow] = await Promise.all([getProjectDto(projectId), getProjectOrThrow(projectId)]);
    if (!project.videoMetadata || !project.telemetrySummary) throw new AppError("ANALYSIS_REQUIRED");

    const videoFile = projectRow.files.find((f) => f.role === "VIDEO");
    if (!videoFile) throw new AppError("FILE_NOT_FOUND");
    const localPath = getStorage().resolveLocalPath(videoFile.storageKey);
    const logoFile = projectRow.files.find((f) => f.role === "LOGO");

    const [framePng, series, flightPath, logoImage] = await Promise.all([
      grabFramePng(localPath, t),
      loadTelemetrySeries(projectId),
      loadFlightPath(projectId).catch(() => null),
      logoFile ? getStorage().readBuffer(logoFile.storageKey).then(loadImageFromBuffer) : Promise.resolve(null),
    ]);

    const interpolator = createInterpolator(series);
    const frame = buildFrameState(
      t,
      interpolator,
      project.telemetrySettings,
      { altitudeSource: project.overlayConfig.altitudeSource },
      project.telemetrySummary.capabilities,
    );

    const vw = project.videoMetadata.video.width;
    const vh = project.videoMetadata.video.height;

    registerOverlayFonts();
    const canvas = createCanvas(vw, vh);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

    const bgImage = await loadImageFromBuffer(framePng);
    ctx.drawImage(bgImage as unknown as CanvasImageSource, 0, 0, vw, vh);

    const rc: RenderContext = {
      frameWidth: vw,
      frameHeight: vh,
      unit: unitOf({ width: vw, height: vh }),
      config: project.overlayConfig,
      branding: { projectName: project.name, companyName: project.companyName },
      assets: { logo: logoImage as unknown as CanvasImageSource | null, basemap: null, flightPath, profile: buildProfile(series) },
    };
    drawFullFrame(ctx, rc, frame);

    const outW = Math.max(1, Math.round(vw * scale));
    const outH = Math.max(1, Math.round(vh * scale));
    let outputCanvas = canvas;
    if (scale !== 1) {
      outputCanvas = createCanvas(outW, outH);
      const outCtx = outputCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      outCtx.drawImage(canvas as unknown as CanvasImageSource, 0, 0, outW, outH);
    }

    const png = await outputCanvas.encode("png");
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  });
}
