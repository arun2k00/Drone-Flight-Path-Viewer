import type { FlightPathFeature, FlightPathGeoJson, LonLat } from "@/lib/map/geojson";
import { splitPathAtTime } from "@/lib/map/geojson";
import { fitViewport, metersPerBoxHeight, projectToBox } from "@/lib/map/projection";
import type { FrameState } from "@/lib/overlay/frame-state";
import { font } from "../fonts";
import type { MapMarker, MiniMapElement } from "../model";
import { OVERLAY_THEME } from "../theme";
import type { RenderContext } from "./types";
import { fillTextSpaced, withHalo } from "./text";

const NICE_MULTIPLIERS = [1, 2, 5];

function niceScaleValue(target: number): number {
  if (target <= 0) return 1;
  const exp = Math.floor(Math.log10(target));
  const base = 10 ** exp;
  let best = base;
  for (const m of NICE_MULTIPLIERS) {
    const candidate = m * base;
    if (candidate <= target) best = candidate;
  }
  return best;
}

function formatScaleLabel(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function pathFeatureOf(path: FlightPathGeoJson): Extract<FlightPathFeature, { properties: { kind: "path" } }> | null {
  return path.features.find((f): f is Extract<FlightPathFeature, { properties: { kind: "path" } }> => f.properties.kind === "path") ?? null;
}

function pointFeatureOf(path: FlightPathGeoJson, kind: "start" | "end"): Extract<FlightPathFeature, { properties: { kind: "start" | "end" } }> | null {
  return (
    path.features.find((f): f is Extract<FlightPathFeature, { properties: { kind: "start" | "end" } }> => f.properties.kind === kind) ?? null
  );
}

function drawGpsUnavailable(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.font = font("DTS Sans SemiBold", 0.08 * h);
  ctx.fillStyle = OVERLAY_THEME.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GPS UNAVAILABLE", w / 2, h / 2);
}

function drawGraticule(ctx: CanvasRenderingContext2D, w: number, h: number, u: number): void {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = Math.max(1, 1 * u);
  for (const x of [w / 4, w / 2, (3 * w) / 4]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (const y of [h / 4, h / 2, (3 * h) / 4]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

export function drawMiniMap(ctx: CanvasRenderingContext2D, el: MiniMapElement, w: number, h: number, rc: RenderContext, frame: FrameState | null): void {
  const u = rc.unit;
  const r = Math.min(0.05 * Math.min(w, h), 14 * u);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.clip();

  ctx.fillStyle = `rgba(${OVERLAY_THEME.panelRgb}, 0.72)`;
  ctx.fillRect(0, 0, w, h);

  const basemap = rc.assets.basemap;
  if (basemap) {
    ctx.drawImage(basemap.image, 0, 0, w, h);
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(0, 0, w, h);
  } else {
    drawGraticule(ctx, w, h, u);
  }

  const path = rc.assets.flightPath;
  if (!path || !path.bbox) {
    drawGpsUnavailable(ctx, w, h);
    ctx.restore();
    return;
  }

  const bounds = { minLon: path.bbox[0], minLat: path.bbox[1], maxLon: path.bbox[2], maxLat: path.bbox[3] };
  const viewport = fitViewport(bounds, w / h, el.paddingRatio);
  const project = (lon: number, lat: number) => {
    const { u: pu, v: pv } = projectToBox(viewport, lon, lat);
    return [pu * w, pv * h] as const;
  };

  const pathFeature = pathFeatureOf(path);
  const latitude = frame?.display.latitude ?? null;
  const longitude = frame?.display.longitude ?? null;
  const current: LonLat | null = latitude !== null && longitude !== null ? [longitude, latitude] : null;

  if (el.showPath && pathFeature) {
    const points = pathFeature.geometry.coordinates.map(([lon, lat]) => project(lon, lat));
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = OVERLAY_THEME.pathRemaining;
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  }

  if (el.showProgress && frame && pathFeature) {
    const { flown } = splitPathAtTime(path, frame.telemetry.srtTime, current);
    if (flown.length >= 2) {
      const points = flown.map(([lon, lat]) => project(lon, lat));
      ctx.strokeStyle = rc.config.accentColor;
      ctx.lineWidth = 2.5 * u;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    }
  }

  if (el.showStartEnd) {
    const start = pointFeatureOf(path, "start");
    const end = pointFeatureOf(path, "end");
    if (start) {
      const [x, y] = project(...start.geometry.coordinates);
      ctx.beginPath();
      ctx.arc(x, y, 3.5 * u, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${OVERLAY_THEME.panelRgb}, 1)`;
      ctx.fill();
      ctx.strokeStyle = OVERLAY_THEME.value;
      ctx.lineWidth = 1.5 * u;
      ctx.stroke();
    }
    if (end) {
      const [x, y] = project(...end.geometry.coordinates);
      const s = 6 * u;
      ctx.beginPath();
      ctx.rect(x - s / 2, y - s / 2, s, s);
      ctx.fillStyle = `rgba(${OVERLAY_THEME.panelRgb}, 1)`;
      ctx.fill();
      ctx.strokeStyle = OVERLAY_THEME.value;
      ctx.lineWidth = 1.5 * u;
      ctx.stroke();
    }
  }

  if (el.showMarkers) {
    for (const marker of rc.config.mapMarkers as MapMarker[]) {
      const [x, y] = project(marker.longitude, marker.latitude);
      const radius = 5 * u;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-radius / Math.SQRT2, -radius / Math.SQRT2, (radius * 2) / Math.SQRT2, (radius * 2) / Math.SQRT2);
      ctx.fillStyle = OVERLAY_THEME.value;
      ctx.fill();
      ctx.strokeStyle = rc.config.accentColor;
      ctx.lineWidth = 1.5 * u;
      ctx.stroke();
      ctx.restore();

      withHalo(ctx, u, () => {
        ctx.font = font("DTS Sans Medium", 10 * u);
        ctx.fillStyle = OVERLAY_THEME.value;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(marker.label, x + 8 * u, y);
      });
    }
  }

  if (current === null) {
    drawGpsUnavailable(ctx, w, h);
  } else {
    const [x, y] = project(...current);
    const heading = frame?.display.heading ?? null;
    if (el.showHeading && heading !== null) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((heading * Math.PI) / 180);
      ctx.beginPath();
      ctx.moveTo(0, -11 * u);
      ctx.lineTo(7 * u, 7 * u);
      ctx.lineTo(0, 3 * u);
      ctx.lineTo(-7 * u, 7 * u);
      ctx.closePath();
      ctx.fillStyle = rc.config.accentColor;
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
      ctx.lineWidth = 1 * u;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 4.5 * u, 0, Math.PI * 2);
      ctx.fillStyle = rc.config.accentColor;
      ctx.fill();
      ctx.strokeStyle = OVERLAY_THEME.value;
      ctx.lineWidth = 1.5 * u;
      ctx.stroke();
    }
  }

  const pad = 0.06 * Math.min(w, h);
  if (el.showNorthArrow) {
    const nx = w - pad - 6 * u;
    const ny = pad + 8 * u;
    ctx.save();
    ctx.translate(nx, ny);
    ctx.beginPath();
    ctx.moveTo(0, -8 * u);
    ctx.lineTo(5 * u, 2 * u);
    ctx.lineTo(-5 * u, 2 * u);
    ctx.closePath();
    ctx.fillStyle = OVERLAY_THEME.value;
    ctx.fill();
    ctx.restore();
    ctx.font = font("DTS Sans SemiBold", 9 * u);
    ctx.fillStyle = OVERLAY_THEME.value;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("N", nx, ny + 3 * u);
  }

  if (el.showScaleBar) {
    const centreLat = (bounds.minLat + bounds.maxLat) / 2;
    const mpp = metersPerBoxHeight(viewport, centreLat) / h;
    const target = 0.28 * w * mpp;
    const nice = niceScaleValue(target);
    const lengthPx = nice / mpp;
    const barY = h - pad;
    const barX = pad;

    withHalo(ctx, u, () => {
      ctx.font = font("DTS Sans Medium", 9 * u);
      ctx.fillStyle = OVERLAY_THEME.value;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(formatScaleLabel(nice), barX, barY - 4 * u);
    });

    ctx.strokeStyle = OVERLAY_THEME.value;
    ctx.lineWidth = 1.5 * u;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX + lengthPx, barY);
    ctx.stroke();
    for (const x of [barX, barX + lengthPx]) {
      ctx.beginPath();
      ctx.moveTo(x, barY - 4 * u);
      ctx.lineTo(x, barY + 4 * u);
      ctx.stroke();
    }
  }

  if (basemap) {
    withHalo(ctx, u, () => {
      ctx.font = font("DTS Sans Regular", 8 * u);
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.textBaseline = "bottom";
      fillTextSpaced(ctx, basemap.attribution, w - 4 * u, h - 4 * u, 0, "right");
    });
  }

  ctx.restore();

  ctx.strokeStyle = OVERLAY_THEME.panelStroke;
  ctx.lineWidth = Math.max(1, 1 * u);
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.stroke();
}
