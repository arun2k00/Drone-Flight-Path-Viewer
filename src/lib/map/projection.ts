import type { GeoBounds } from "@/types/telemetry";

const EARTH_CIRCUMFERENCE_M = 40075016.686;
const MAX_MERCATOR_LAT = 85.05112878;

/** cx, cy: centre in world units in [0,1]; k: box-height units per world unit; aspect = box width / height. */
export interface MapViewport {
  cx: number;
  cy: number;
  k: number;
  aspect: number;
}

export const mercatorX = (lon: number): number => (lon + 180) / 360;

export const mercatorY = (lat: number): number => {
  const phi = (Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat)) * Math.PI) / 180;
  return (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2;
};

/** `paddingRatio` reserves a border on each side; `aspect` = box width/height. */
export function fitViewport(b: GeoBounds, aspect: number, paddingRatio: number): MapViewport {
  const x0 = mercatorX(b.minLon);
  const x1 = mercatorX(b.maxLon);
  const y0 = mercatorY(b.maxLat);
  const y1 = mercatorY(b.minLat);
  const latC = (b.minLat + b.maxLat) / 2;
  const minSpan = 60 / (EARTH_CIRCUMFERENCE_M * Math.cos((latC * Math.PI) / 180));
  const dx = Math.max(x1 - x0, minSpan);
  const dy = Math.max(y1 - y0, minSpan);
  const inner = 1 - 2 * paddingRatio;
  const k = Math.min((inner * aspect) / dx, inner / dy);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, k, aspect };
}

export function projectToBox(vp: MapViewport, lon: number, lat: number): { u: number; v: number } {
  return { u: 0.5 + ((mercatorX(lon) - vp.cx) * vp.k) / vp.aspect, v: 0.5 + (mercatorY(lat) - vp.cy) * vp.k };
}

export const metersPerBoxHeight = (vp: MapViewport, lat: number): number =>
  (1 / vp.k) * EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180);
