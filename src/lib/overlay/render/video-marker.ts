import type { FrameState } from "@/lib/overlay/frame-state";
import { font } from "../fonts";
import { OVERLAY_THEME } from "../theme";
import type { VideoMarkerElement } from "../model";
import type { RenderContext } from "./types";
import { truncateToWidth } from "./text";

/** Visible only while the video clock is within [startTime, endTime]. */
export function drawVideoMarker(ctx: CanvasRenderingContext2D, el: VideoMarkerElement, w: number, h: number, rc: RenderContext, frame: FrameState | null): void {
  if (!frame || frame.videoTime < el.startTime || frame.videoTime > el.endTime) return;
  const u = rc.unit;

  ctx.beginPath();
  ctx.arc(h / 2, h / 2, 0.22 * h, 0, Math.PI * 2);
  ctx.fillStyle = rc.config.accentColor;
  ctx.fill();
  ctx.strokeStyle = OVERLAY_THEME.value;
  ctx.lineWidth = 1.5 * u;
  ctx.stroke();

  const pillX = h * 0.9;
  const pillW = w - h * 0.9;
  ctx.fillStyle = `rgba(${OVERLAY_THEME.panelRgb}, 0.72)`;
  ctx.beginPath();
  ctx.roundRect(pillX, h * 0.15, pillW, h * 0.7, h * 0.2);
  ctx.fill();

  ctx.font = font("DTS Sans SemiBold", 0.4 * h);
  ctx.fillStyle = OVERLAY_THEME.value;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const textX = pillX + 0.25 * h;
  const label = truncateToWidth(ctx, el.label, pillX + pillW - textX - 0.1 * h);
  ctx.fillText(label, textX, h / 2);
}
