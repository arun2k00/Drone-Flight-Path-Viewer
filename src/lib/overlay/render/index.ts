import type { FrameState } from "@/lib/overlay/frame-state";
import { toPixelRect } from "../layout";
import type { OverlayElement } from "../model";
import { drawCrosshair } from "./crosshair";
import { drawGraph } from "./graph";
import { drawGrid } from "./grid";
import { drawHeadingIndicator } from "./heading-indicator";
import { drawLogo } from "./logo";
import { drawMiniMap } from "./mini-map";
import { drawProjectLabel } from "./project-label";
import { drawTelemetryPanel } from "./telemetry-panel";
import type { RenderContext } from "./types";
import { drawVideoMarker } from "./video-marker";

export type { RenderAssets, RenderContext } from "./types";

export function drawElement(ctx: CanvasRenderingContext2D, el: OverlayElement, w: number, h: number, rc: RenderContext, frame: FrameState | null): void {
  switch (el.type) {
    case "telemetryPanel":
      drawTelemetryPanel(ctx, el, w, h, rc, frame);
      return;
    case "miniMap":
      drawMiniMap(ctx, el, w, h, rc, frame);
      return;
    case "headingIndicator":
      drawHeadingIndicator(ctx, el, w, h, rc, frame);
      return;
    case "grid":
      drawGrid(ctx, el, w, h, rc);
      return;
    case "crosshair":
      drawCrosshair(ctx, el, w, h, rc);
      return;
    case "projectLabel":
      drawProjectLabel(ctx, el, w, h, rc);
      return;
    case "logo":
      drawLogo(ctx, el, w, h, rc);
      return;
    case "videoMarker":
      drawVideoMarker(ctx, el, w, h, rc, frame);
      return;
    case "altitudeGraph":
    case "speedGraph":
      drawGraph(ctx, el, w, h, rc, frame);
      return;
  }
}

/**
 * Draws every visible element in zIndex order onto a full frame. Used only by the parity endpoint
 * and tests — the export itself uses the static layer plus the dynamic atlas.
 */
export function drawFullFrame(ctx: CanvasRenderingContext2D, rc: RenderContext, frame: FrameState | null): void {
  const sorted = [...rc.config.elements].filter((el) => el.visible).sort((a, b) => a.zIndex - b.zIndex);
  const frameRect = { width: rc.frameWidth, height: rc.frameHeight };

  for (const el of sorted) {
    const { x, y, w, h } = toPixelRect(el, frameRect);
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    ctx.globalAlpha = el.opacity;
    drawElement(ctx, el, w, h, rc, frame);
    ctx.restore();
  }
}
