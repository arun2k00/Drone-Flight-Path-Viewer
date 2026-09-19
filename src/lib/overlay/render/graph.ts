import type { FrameState } from "@/lib/overlay/frame-state";
import { formatAltitude, formatSpeed } from "@/lib/telemetry/format";
import { valueRange } from "@/lib/telemetry/profile";
import { font } from "../fonts";
import type { GraphElement } from "../model";
import { OVERLAY_THEME } from "../theme";
import type { RenderContext } from "./types";
import { fillTextSpaced, withHalo } from "./text";

/** Binary search: index of the last profile sample at or before t. */
function indexAt(t: Float64Array, time: number): number {
  let lo = 0;
  let hi = t.length - 1;
  let k = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= time) {
      k = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return k;
}

/**
 * Altitude or speed over the whole flight: the flown part in the accent colour with a soft fill,
 * the rest muted, and a cursor at the current moment. Gaps (NaN) break the line instead of bridging it.
 */
export function drawGraph(ctx: CanvasRenderingContext2D, el: GraphElement, w: number, h: number, rc: RenderContext, frame: FrameState | null): void {
  const profile = rc.assets.profile;
  const u = rc.unit;
  const isAltitude = el.type === "altitudeGraph";
  const values = !profile ? null : isAltitude ? (rc.config.altitudeSource === "relative" ? profile.relativeAltitude : profile.absoluteAltitude) : profile.speed;
  const range = values ? valueRange(values) : null;

  const pad = Math.min(0.09 * Math.min(w, h), 16 * u);
  const titlePx = Math.max(8, 0.13 * h);
  const valuePx = Math.max(9, 0.17 * h);

  if (el.background === "panel") {
    ctx.fillStyle = `rgba(${OVERLAY_THEME.panelRgb}, ${el.backgroundOpacity})`;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, Math.min(0.08 * Math.min(w, h), 12 * u));
    ctx.fill();
    ctx.strokeStyle = OVERLAY_THEME.panelStroke;
    ctx.lineWidth = Math.max(1, u);
    ctx.stroke();
  }

  // Header: label left, current value right.
  const current = frame ? (isAltitude ? frame.display.altitude : frame.display.speedMps) : null;
  const unit = isAltitude ? rc.config.units.altitude : rc.config.units.speed;
  const valueText = isAltitude ? formatAltitude(current, rc.config.units.altitude) : formatSpeed(current, rc.config.units.speed).value;
  const headerY = pad + valuePx / 2;
  const header = () => {
    ctx.textBaseline = "middle";
    ctx.font = font("DTS Sans SemiBold", titlePx);
    ctx.fillStyle = OVERLAY_THEME.label;
    fillTextSpaced(ctx, isAltitude ? "ALTITUDE" : "SPEED", pad, headerY, 0.08 * titlePx, "left");
    ctx.font = font("DTS Sans Medium", titlePx);
    const unitW = ctx.measureText(unit).width;
    ctx.fillText(unit, w - pad - unitW, headerY);
    ctx.font = font("DTS Mono Medium", valuePx);
    ctx.fillStyle = current === null ? OVERLAY_THEME.muted : OVERLAY_THEME.value;
    ctx.textAlign = "right";
    ctx.fillText(valueText, w - pad - unitW - 0.3 * titlePx, headerY);
    ctx.textAlign = "left";
  };
  if (el.background === "panel") header();
  else withHalo(ctx, u, header);

  const plot = { x: pad, y: pad + valuePx + 0.35 * valuePx, w: w - 2 * pad, h: h - pad - (pad + valuePx + 0.35 * valuePx) };
  if (!profile || !values || !range || plot.h <= 4 || plot.w <= 4) {
    ctx.font = font("DTS Sans Medium", titlePx);
    ctx.fillStyle = OVERLAY_THEME.muted;
    ctx.textBaseline = "middle";
    ctx.fillText(isAltitude ? "No altitude in this SRT" : "No speed data", plot.x, plot.y + plot.h / 2);
    return;
  }

  const t0 = profile.t[0];
  const t1 = profile.t[profile.t.length - 1];
  const span = Math.max(1e-6, t1 - t0);
  // Pad the value axis so a flat line doesn't sit on the frame edge.
  const vPad = Math.max((range.max - range.min) * 0.12, isAltitude ? 2 : 0.5);
  const vMin = range.min - vPad;
  const vMax = range.max + vPad;
  const px = (t: number) => plot.x + ((t - t0) / span) * plot.w;
  const py = (v: number) => plot.y + plot.h - ((v - vMin) / (vMax - vMin)) * plot.h;

  const tracePath = () => {
    ctx.beginPath();
    let open = false;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (!Number.isFinite(v)) {
        open = false;
        continue;
      }
      if (open) ctx.lineTo(px(profile.t[i]), py(v));
      else ctx.moveTo(px(profile.t[i]), py(v));
      open = true;
    }
  };

  const now = frame?.telemetry.srtTime ?? t0;
  const cursorX = Math.min(plot.x + plot.w, Math.max(plot.x, px(now)));
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Whole flight, muted.
  tracePath();
  ctx.strokeStyle = OVERLAY_THEME.pathRemaining;
  ctx.lineWidth = Math.max(1, 1.5 * u);
  ctx.stroke();

  // Flown part: soft fill + accent line, clipped at the cursor.
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.x - 2 * u, plot.y - 4 * u, cursorX - plot.x + 2 * u, plot.h + 8 * u);
  ctx.clip();
  for (let i = 0; i < values.length; i++) {
    // Fill each finite run down to the baseline.
    if (!Number.isFinite(values[i]) || (i > 0 && Number.isFinite(values[i - 1]))) continue;
    let j = i;
    ctx.beginPath();
    ctx.moveTo(px(profile.t[i]), plot.y + plot.h);
    while (j < values.length && Number.isFinite(values[j])) {
      ctx.lineTo(px(profile.t[j]), py(values[j]));
      j++;
    }
    ctx.lineTo(px(profile.t[j - 1]), plot.y + plot.h);
    ctx.closePath();
    ctx.fillStyle = `${rc.config.accentColor}40`;
    ctx.fill();
  }
  tracePath();
  ctx.strokeStyle = rc.config.accentColor;
  ctx.lineWidth = Math.max(1.5, 2.5 * u);
  ctx.stroke();
  ctx.restore();

  // Cursor.
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, u);
  ctx.beginPath();
  ctx.moveTo(cursorX, plot.y);
  ctx.lineTo(cursorX, plot.y + plot.h);
  ctx.stroke();
  const v = values[indexAt(profile.t, now)];
  const dot = current ?? (Number.isFinite(v) ? v : null);
  if (dot !== null) {
    ctx.beginPath();
    ctx.arc(cursorX, py(Math.min(vMax, Math.max(vMin, dot))), Math.max(2, 4 * u), 0, Math.PI * 2);
    ctx.fillStyle = rc.config.accentColor;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1, 1.5 * u);
    ctx.stroke();
  }
}
