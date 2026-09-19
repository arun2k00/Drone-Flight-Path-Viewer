import type { CrosshairElement } from "../model";
import type { RenderContext } from "./types";

/** The box is square in pixels and the crosshair is centred in it. */
export function drawCrosshair(ctx: CanvasRenderingContext2D, el: CrosshairElement, w: number, h: number, rc: RenderContext): void {
  const u = rc.unit;
  const cx = w / 2;
  const cy = h / 2;
  const L = (el.size * u) / 2;
  const g = el.gap * u;
  const lw = el.lineWidth * u;

  const segments: Array<[number, number, number, number]> = [
    [cx + g, cy, cx + L, cy],
    [cx - g, cy, cx - L, cy],
    [cx, cy + g, cx, cy + L],
    [cx, cy - g, cx, cy - L],
  ];

  ctx.lineCap = "butt";
  for (const [x0, y0, x1, y1] of segments) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.lineWidth = lw + 2 * u;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  for (const [x0, y0, x1, y1] of segments) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  if (el.showCenterDot) {
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(cx, cy, lw, 0, Math.PI * 2);
    ctx.fill();
  }
}
