import { formatHeading } from "@/lib/telemetry/format";
import { normalize360 } from "@/lib/telemetry/normalizer";
import type { FrameState } from "@/lib/overlay/frame-state";
import { font } from "../fonts";
import { OVERLAY_THEME } from "../theme";
import type { HeadingIndicatorElement } from "../model";
import type { RenderContext } from "./types";

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function drawHeadingIndicator(
  ctx: CanvasRenderingContext2D,
  _el: HeadingIndicatorElement,
  w: number,
  h: number,
  rc: RenderContext,
  frame: FrameState | null,
): void {
  const u = rc.unit;
  ctx.save();
  ctx.fillStyle = `rgba(${OVERLAY_THEME.panelRgb}, 0.62)`;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, Math.min(0.18 * h, 10 * u));
  ctx.fill();
  ctx.clip();

  const pad = 0.12 * h;
  const heading = frame?.display.heading ?? null;

  if (heading === null) {
    ctx.font = font("DTS Sans SemiBold", 0.34 * h);
    ctx.fillStyle = OVERLAY_THEME.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("HDG —", w / 2, h / 2);
    ctx.restore();
    return;
  }

  const pxPerDeg = w / 90;
  const dStart = Math.ceil((heading - 45) / 5) * 5;
  const dEnd = Math.floor((heading + 45) / 5) * 5;
  ctx.lineCap = "butt";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let d = dStart; d <= dEnd; d += 5) {
    const x = w / 2 + (d - heading) * pxPerDeg;
    const major45 = d % 45 === 0;
    const major15 = d % 15 === 0;
    const tickH = major45 ? 0.3 * h : major15 ? 0.2 * h : 0.12 * h;
    ctx.strokeStyle = `rgba(255, 255, 255, ${major45 ? 0.9 : 0.55})`;
    ctx.lineWidth = Math.max(1, 1.2 * u);
    ctx.beginPath();
    ctx.moveTo(x, h - pad);
    ctx.lineTo(x, h - pad - tickH);
    ctx.stroke();

    if (major45 && Math.abs(x - w / 2) > 0.22 * w) {
      const label = CARDINALS[normalize360(d) / 45];
      ctx.font = font("DTS Sans SemiBold", 0.22 * h);
      ctx.fillStyle = OVERLAY_THEME.value;
      ctx.fillText(label, x, h - pad - 0.3 * h - 0.14 * h);
    }
  }

  const valueText = formatHeading(heading);
  ctx.font = font("DTS Mono Medium", 0.3 * h);
  const textW = ctx.measureText(valueText).width;
  const pillW = textW + 0.3 * h;
  const pillH = 0.4 * h;
  const pillX = w / 2 - pillW / 2;
  const pillY = 0.06 * h;
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();

  ctx.fillStyle = OVERLAY_THEME.value;
  ctx.fillText(valueText, w / 2, pillY + pillH / 2);

  if (frame?.display.headingSource === "gps-course") {
    ctx.font = font("DTS Sans SemiBold", 0.18 * h);
    ctx.fillStyle = OVERLAY_THEME.label;
    ctx.textAlign = "right";
    ctx.fillText("TRK", pillX - 0.08 * h, pillY + pillH / 2);
  }

  const pointerH = 0.1 * h;
  ctx.fillStyle = rc.config.accentColor;
  ctx.beginPath();
  ctx.moveTo(w / 2, h - pad - pointerH);
  ctx.lineTo(w / 2 - pointerH * 0.6, h - pad);
  ctx.lineTo(w / 2 + pointerH * 0.6, h - pad);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
