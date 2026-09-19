import { OVERLAY_THEME } from "../theme";
import type { GridElement } from "../model";
import type { RenderContext } from "./types";

/** Lines/dots are symmetric about the box centre; `el.opacity` is applied by the caller. */
export function drawGrid(ctx: CanvasRenderingContext2D, el: GridElement, w: number, h: number, rc: RenderContext): void {
  const u = rc.unit;
  const cell = el.cellSize * u;
  const lw = Math.max(0.5, el.lineWidth * u);
  const cx = w / 2;
  const cy = h / 2;

  const verticals: Array<{ x: number; major: boolean }> = [];
  for (let i = -Math.ceil(cx / cell); i <= Math.ceil(cx / cell); i++) {
    const x = cx + i * cell;
    if (x < 0 || x > w) continue;
    verticals.push({ x, major: el.majorEvery > 0 && i % el.majorEvery === 0 });
  }
  const horizontals: Array<{ y: number; major: boolean }> = [];
  for (let j = -Math.ceil(cy / cell); j <= Math.ceil(cy / cell); j++) {
    const y = cy + j * cell;
    if (y < 0 || y > h) continue;
    horizontals.push({ y, major: el.majorEvery > 0 && j % el.majorEvery === 0 });
  }

  if (el.style === "lines") {
    ctx.lineCap = "butt";
    for (const { x, major } of verticals) {
      const xr = Math.round(x) + (Math.round(lw) % 2 === 1 ? 0.5 : 0);
      ctx.strokeStyle = major ? OVERLAY_THEME.gridMajor : OVERLAY_THEME.gridMinor;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(xr, 0);
      ctx.lineTo(xr, h);
      ctx.stroke();
    }
    for (const { y, major } of horizontals) {
      const yr = Math.round(y) + (Math.round(lw) % 2 === 1 ? 0.5 : 0);
      ctx.strokeStyle = major ? OVERLAY_THEME.gridMajor : OVERLAY_THEME.gridMinor;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(0, yr);
      ctx.lineTo(w, yr);
      ctx.stroke();
    }
  } else {
    for (const { x, major: xMajor } of verticals) {
      for (const { y, major: yMajor } of horizontals) {
        const bothMajor = xMajor && yMajor;
        const radius = Math.max(0.8, 1.1 * lw) * (bothMajor ? 1.6 : 1);
        ctx.fillStyle = bothMajor ? OVERLAY_THEME.gridMajor : OVERLAY_THEME.gridMinor;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
