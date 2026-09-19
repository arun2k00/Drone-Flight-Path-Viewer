import type { OverlayElement } from "./model";

export interface Frame {
  width: number;
  height: number;
}

export const unitOf = (f: Frame): number => Math.min(f.width, f.height) / 1080;

export type AspectClass = "landscape" | "portrait" | "square";

export function aspectClass(f: Frame): AspectClass {
  const r = f.width / f.height;
  return r >= 1.2 ? "landscape" : r <= 0.83 ? "portrait" : "square";
}

export function toPixelRect(el: Pick<OverlayElement, "x" | "y" | "width" | "height">, f: Frame) {
  return {
    x: Math.round(el.x * f.width),
    y: Math.round(el.y * f.height),
    w: Math.max(2, Math.round(el.width * f.width)),
    h: Math.max(2, Math.round(el.height * f.height)),
  };
}

/** Minimum element size in reference px (u units). */
export const MIN_SIZE_U: Record<OverlayElement["type"], { w: number; h: number }> = {
  telemetryPanel: { w: 160, h: 90 },
  miniMap: { w: 140, h: 100 },
  logo: { w: 40, h: 24 },
  projectLabel: { w: 160, h: 40 },
  headingIndicator: { w: 160, h: 36 },
  videoMarker: { w: 80, h: 24 },
  crosshair: { w: 24, h: 24 },
  grid: { w: 0, h: 0 },
  altitudeGraph: { w: 160, h: 70 },
  speedGraph: { w: 160, h: 70 },
};

export function clampElement<T extends OverlayElement>(el: T, f: Frame): T {
  const u = unitOf(f);
  const minW = Math.min(1, (MIN_SIZE_U[el.type].w * u) / f.width);
  const minH = Math.min(1, (MIN_SIZE_U[el.type].h * u) / f.height);
  const width = Math.min(1, Math.max(minW, el.width));
  const height = Math.min(1, Math.max(minH, el.height));
  const x = Math.min(Math.max(0, el.x), 1 - width);
  const y = Math.min(Math.max(0, el.y), 1 - height);
  return { ...el, x, y, width, height };
}

export type Corner = "tl" | "tr" | "bl" | "br";

const PRESET_MARGIN_U = 32;

/** Quick position presets: margin 32u. */
export function positionPreset<T extends OverlayElement>(el: T, corner: Corner, f: Frame): T {
  const u = unitOf(f);
  const marginX = (PRESET_MARGIN_U * u) / f.width;
  const marginY = (PRESET_MARGIN_U * u) / f.height;
  const x = corner === "tl" || corner === "bl" ? marginX : 1 - marginX - el.width;
  const y = corner === "tl" || corner === "tr" ? marginY : 1 - marginY - el.height;
  return clampElement({ ...el, x: Math.max(0, x), y: Math.max(0, y) }, f);
}

export const SNAP_MARGIN_U = 32;
export const SNAP_THRESHOLD_PX = 6;

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
}

/**
 * Candidates are the 32u position-preset margins and the frame centre;
 * `stagePx` is the on-screen (CSS px) size of the stage, since the 6px threshold is a screen distance.
 */
export function snapPosition(x: number, y: number, w: number, h: number, f: Frame, stagePx: { width: number; height: number }): SnapResult {
  const u = unitOf(f);
  const mx = (SNAP_MARGIN_U * u) / f.width;
  const my = (SNAP_MARGIN_U * u) / f.height;
  const candidatesX = [mx, 1 - mx - w, 0.5 - w / 2];
  const candidatesY = [my, 1 - my - h, 0.5 - h / 2];
  const threshX = stagePx.width > 0 ? SNAP_THRESHOLD_PX / stagePx.width : 0;
  const threshY = stagePx.height > 0 ? SNAP_THRESHOLD_PX / stagePx.height : 0;

  let nx = x;
  let snappedX = false;
  for (const c of candidatesX) {
    if (Math.abs(x - c) <= threshX) {
      nx = c;
      snappedX = true;
      break;
    }
  }

  let ny = y;
  let snappedY = false;
  for (const c of candidatesY) {
    if (Math.abs(y - c) <= threshY) {
      ny = c;
      snappedY = true;
      break;
    }
  }

  return { x: nx, y: ny, snappedX, snappedY };
}

/** Resizes an element about its current centre (used when a size control, not a drag handle, changes W/H — e.g. the crosshair size slider). */
export function resizeAboutCenter<T extends OverlayElement>(el: T, widthNorm: number, heightNorm: number, f: Frame): T {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return clampElement({ ...el, width: widthNorm, height: heightNorm, x: cx - widthNorm / 2, y: cy - heightNorm / 2 }, f);
}

export interface BoxSpecU {
  anchor: "tl" | "tr" | "bl" | "br" | "tc" | "bc" | "center";
  marginX: number;
  marginY: number;
  width: number;
  height: number;
}

export function boxFromSpec(spec: BoxSpecU, f: Frame): { x: number; y: number; width: number; height: number } {
  const u = unitOf(f);
  const w = Math.min(f.width, spec.width * u);
  const h = Math.min(f.height, spec.height * u);
  const mx = spec.marginX * u;
  const my = spec.marginY * u;

  let x: number;
  if (spec.anchor === "tl" || spec.anchor === "bl") x = mx;
  else if (spec.anchor === "tr" || spec.anchor === "br") x = f.width - mx - w;
  else x = (f.width - w) / 2;

  let y: number;
  if (spec.anchor === "tl" || spec.anchor === "tr" || spec.anchor === "tc") y = my;
  else if (spec.anchor === "bl" || spec.anchor === "br" || spec.anchor === "bc") y = f.height - my - h;
  else y = (f.height - h) / 2;

  return { x: x / f.width, y: y / f.height, width: w / f.width, height: h / f.height };
}
