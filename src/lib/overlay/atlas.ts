import { AppError } from "@/lib/errors/app-error";
import { toPixelRect, type Frame } from "./layout";
import type { OverlayElement } from "./model";

export interface AtlasSlot {
  elementId: string;
  srcY: number;
  width: number;
  height: number;
  destX: number;
  destY: number;
}

export interface AtlasLayout {
  width: number;
  height: number;
  slots: AtlasSlot[];
}

const evenFloor = (n: number): number => Math.floor(n / 2) * 2;
const evenCeil = (n: number): number => Math.ceil(n / 2) * 2;

/**
 * Stacks every dynamic, visible element vertically into one atlas
 * canvas (rendered once per frame and streamed to FFmpeg's fd 3), so the export never allocates a
 * full-frame RGBA buffer per element. `dynamicVisibleSortedByZ` must already be filtered to visible
 * dynamic elements and sorted by zIndex — the atlas's stacking order becomes the overlay order.
 */
export function buildAtlasLayout(dynamicVisibleSortedByZ: OverlayElement[], out: Frame): AtlasLayout | null {
  if (dynamicVisibleSortedByZ.length === 0) return null;
  let srcY = 0;
  let maxW = 2;
  const slots = dynamicVisibleSortedByZ.map((el) => {
    const r = toPixelRect(el, out);
    const destX = evenFloor(Math.min(Math.max(r.x, 0), out.width - 2));
    const destY = evenFloor(Math.min(Math.max(r.y, 0), out.height - 2));
    const width = Math.max(2, Math.min(evenCeil(r.w), out.width - destX));
    const height = Math.max(2, Math.min(evenCeil(r.h), out.height - destY));
    const slot: AtlasSlot = { elementId: el.id, srcY, width, height, destX, destY };
    srcY += height;
    maxW = Math.max(maxW, width);
    return slot;
  });
  if (srcY > 16384) throw new AppError("EXPORT_TOO_MANY_ELEMENTS");
  return { width: evenCeil(maxW), height: evenCeil(srcY), slots };
}
