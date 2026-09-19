import type { OverlayElement } from "./model";

const DYNAMIC_TYPES = new Set<OverlayElement["type"]>(["telemetryPanel", "miniMap", "headingIndicator", "videoMarker", "altitudeGraph", "speedGraph"]);

/** dynamic elements redraw every clock tick; static elements only on config/asset changes. */
export function isDynamic(el: OverlayElement): boolean {
  return DYNAMIC_TYPES.has(el.type);
}
