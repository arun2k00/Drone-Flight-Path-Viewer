import type { LogoElement } from "../model";
import type { RenderContext } from "./types";

/** Contain-fit, centred; draws nothing when no logo asset is set. */
export function drawLogo(ctx: CanvasRenderingContext2D, _el: LogoElement, w: number, h: number, rc: RenderContext): void {
  const logo = rc.assets.logo;
  if (!logo) return;

  const { width: imgW, height: imgH } = logo as unknown as { width: number; height: number };
  if (!imgW || !imgH) return;

  const scale = Math.min(w / imgW, h / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  ctx.drawImage(logo, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
}
