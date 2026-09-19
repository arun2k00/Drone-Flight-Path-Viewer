import { OVERLAY_THEME } from "../theme";
import type { OverlayFontFamily } from "../fonts";
import { font } from "../fonts";

export type Align = "left" | "right" | "center";

/**
 * Draws text with manual per-character spacing. `ctx.letterSpacing` isn't used: Safari support
 * varies, and measuring character by character gives identical results everywhere.
 */
export function fillTextSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacingPx: number, align: Align = "left"): void {
  if (spacingPx <= 0) {
    const prevAlign = ctx.textAlign;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    ctx.textAlign = prevAlign;
    return;
  }

  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + spacingPx * Math.max(0, text.length - 1);

  let startX = x;
  if (align === "right") startX = x - totalWidth;
  else if (align === "center") startX = x - totalWidth / 2;

  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  let cursor = startX;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], cursor, y);
    cursor += widths[i] + spacingPx;
  }
  ctx.textAlign = prevAlign;
}

/** Returns the largest font size <= desiredPx at which `text` fits within `maxWidth`. */
export function fitFontPx(ctx: CanvasRenderingContext2D, family: OverlayFontFamily, desiredPx: number, text: string, maxWidth: number): number {
  ctx.font = font(family, desiredPx);
  const width = ctx.measureText(text).width;
  if (width <= maxWidth || desiredPx <= 1) return desiredPx;
  const scaled = Math.max(1, desiredPx * (maxWidth / width));
  ctx.font = font(family, scaled);
  return ctx.measureText(text).width <= maxWidth ? scaled : Math.max(1, scaled * (maxWidth / ctx.measureText(text).width));
}

export function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const candidate = text.slice(0, mid) + ellipsis;
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? ellipsis : text.slice(0, lo) + ellipsis;
}

/** Sets a drop shadow for the duration of `draw()`, then resets shadow properties to their defaults. */
export function withHalo(ctx: CanvasRenderingContext2D, u: number, draw: () => void): void {
  ctx.shadowColor = OVERLAY_THEME.halo;
  ctx.shadowBlur = 3 * u;
  ctx.shadowOffsetY = 1 * u;
  draw();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}
