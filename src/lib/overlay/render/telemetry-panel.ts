import { formatAltitude, formatClock, formatCoordinate, formatHeading, formatSpeed, WORST_CASE_STRINGS } from "@/lib/telemetry/format";
import type { DisplayValues, FrameState } from "@/lib/overlay/frame-state";
import { font } from "../fonts";
import { OVERLAY_THEME } from "../theme";
import type { TelemetryPanelElement } from "../model";
import type { RenderContext } from "./types";
import { fillTextSpaced, withHalo } from "./text";

interface Row {
  label: string;
  value: string;
  unit: string;
  muted: boolean;
  /** True only for the synthetic "GPS UNAVAILABLE" row, which spans the value+unit columns as one string. */
  isGpsUnavailable: boolean;
}

const ALL_LABELS = ["ALT", "SPD", "LAT", "LON", "HDG", "TRK", "TIME", "GPS"];
const ALL_UNITS = ["m", "ft", "km/h", "m/s", "mph", "kn"];

function buildRows(el: TelemetryPanelElement, display: DisplayValues, config: RenderContext["config"]): Row[] {
  const rows: Row[] = [];
  const gpsUnavailable = el.fields.coordinates && display.latitude === null;

  if (el.fields.altitude) {
    rows.push({ label: "ALT", value: formatAltitude(display.altitude, config.units.altitude), unit: config.units.altitude, muted: display.altitude === null, isGpsUnavailable: false });
  }
  if (el.fields.speed) {
    const { value } = formatSpeed(display.speedMps, config.units.speed);
    rows.push({ label: "SPD", value, unit: config.units.speed, muted: display.speedMps === null, isGpsUnavailable: false });
  }
  if (el.fields.coordinates) {
    if (gpsUnavailable) {
      rows.push({ label: "GPS", value: "UNAVAILABLE", unit: "", muted: true, isGpsUnavailable: true });
      rows.push({ label: "", value: "", unit: "", muted: true, isGpsUnavailable: false });
    } else {
      rows.push({ label: "LAT", value: formatCoordinate(display.latitude, "lat", config.units.coordinates), unit: "", muted: display.latitude === null, isGpsUnavailable: false });
      rows.push({ label: "LON", value: formatCoordinate(display.longitude, "lon", config.units.coordinates), unit: "", muted: display.longitude === null, isGpsUnavailable: false });
    }
  }
  if (el.fields.heading) {
    const label = display.headingSource === "gps-course" ? "TRK" : "HDG";
    rows.push({ label, value: formatHeading(display.heading), unit: "", muted: display.heading === null, isGpsUnavailable: false });
  }
  if (el.fields.time) {
    rows.push({ label: "TIME", value: formatClock(display.recordedAtMs), unit: "", muted: display.recordedAtMs === null, isGpsUnavailable: false });
  }
  return rows;
}

const EMPTY_DISPLAY: DisplayValues = {
  altitude: null,
  speedMps: null,
  speedSource: null,
  heading: null,
  headingSource: null,
  latitude: null,
  longitude: null,
  recordedAtMs: null,
};

export function drawTelemetryPanel(
  ctx: CanvasRenderingContext2D,
  el: TelemetryPanelElement,
  w: number,
  h: number,
  rc: RenderContext,
  frame: FrameState | null,
): void {
  const display = frame?.display ?? EMPTY_DISPLAY;
  const rows = buildRows(el, display, rc.config);
  if (rows.length === 0) return;

  const u = rc.unit;
  const pad = 0.07 * Math.min(w, h);
  const rowH = (h - 2 * pad) / rows.length;

  let labelPx = 0.3 * rowH;
  let valuePx = 0.52 * rowH;
  let unitPx = 0.3 * rowH;

  const measure = (px: { label: number; value: number; unit: number }) => {
    ctx.font = font("DTS Sans SemiBold", px.label);
    const maxLabelW = Math.max(...ALL_LABELS.map((s) => ctx.measureText(s).width));
    ctx.font = font("DTS Mono Medium", px.value);
    const worstValues = [WORST_CASE_STRINGS.altitude, WORST_CASE_STRINGS.speed, WORST_CASE_STRINGS.latitude, WORST_CASE_STRINGS.longitude, WORST_CASE_STRINGS.heading, WORST_CASE_STRINGS.clock];
    const maxValueW = Math.max(...worstValues.map((s) => ctx.measureText(s).width));
    ctx.font = font("DTS Sans Medium", px.unit);
    const maxUnitW = Math.max(...ALL_UNITS.map((s) => ctx.measureText(s).width));
    return { maxLabelW, maxValueW, maxUnitW };
  };

  let metrics = measure({ label: labelPx, value: valuePx, unit: unitPx });
  let need = pad + metrics.maxLabelW + 0.35 * rowH + metrics.maxValueW + 0.15 * rowH + metrics.maxUnitW + pad;
  if (need > w) {
    const scale = w / need;
    labelPx *= scale;
    valuePx *= scale;
    unitPx *= scale;
    metrics = measure({ label: labelPx, value: valuePx, unit: unitPx });
    need = pad + metrics.maxLabelW + 0.35 * rowH + metrics.maxValueW + 0.15 * rowH + metrics.maxUnitW + pad;
  }

  if (el.background === "panel") {
    const r = Math.min(0.06 * Math.min(w, h), 12 * u);
    ctx.fillStyle = `rgba(${OVERLAY_THEME.panelRgb}, ${el.backgroundOpacity})`;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);
    ctx.fill();
    ctx.strokeStyle = OVERLAY_THEME.panelStroke;
    ctx.lineWidth = Math.max(1, 1 * u);
    ctx.stroke();
  }

  const drawRow = (row: Row, i: number) => {
    const y = pad + rowH * (i + 0.5);
    ctx.textBaseline = "middle";

    if (row.label === "" && row.value === "") return;

    if (row.isGpsUnavailable) {
      ctx.font = font("DTS Sans SemiBold", labelPx);
      ctx.fillStyle = OVERLAY_THEME.label;
      fillTextSpaced(ctx, row.label, pad, y, 0.08 * labelPx, "left");
      ctx.font = font("DTS Sans SemiBold", 0.34 * rowH);
      ctx.fillStyle = OVERLAY_THEME.muted;
      ctx.textAlign = "left";
      ctx.fillText(row.value, pad + metrics.maxLabelW + 0.35 * rowH, y);
      ctx.textAlign = "left";
      return;
    }

    ctx.font = font("DTS Sans SemiBold", labelPx);
    ctx.fillStyle = OVERLAY_THEME.label;
    fillTextSpaced(ctx, row.label, pad, y, 0.08 * labelPx, "left");

    const unitCol = metrics.maxUnitW;
    ctx.font = font("DTS Mono Medium", valuePx);
    ctx.fillStyle = row.muted ? OVERLAY_THEME.muted : OVERLAY_THEME.value;
    ctx.textAlign = "right";
    ctx.fillText(row.value, w - pad - unitCol - 0.15 * rowH, y);
    ctx.textAlign = "left";

    if (row.unit) {
      ctx.font = font("DTS Sans Medium", unitPx);
      ctx.fillStyle = OVERLAY_THEME.label;
      ctx.fillText(row.unit, w - pad - unitCol, y);
    }
  };

  if (el.background === "panel") {
    rows.forEach(drawRow);
  } else {
    withHalo(ctx, u, () => rows.forEach(drawRow));
  }
}
