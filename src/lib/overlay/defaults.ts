import type { OverlayConfig } from "./model";

/**
 * The config a brand-new project starts with, before any video is uploaded (so no Frame is known
 * yet to instantiate a real template). The editor page replaces this with `defaultOverlayConfig`
 * on first load, once the video's dimensions and capabilities are known.
 */
export function placeholderOverlayConfig(): OverlayConfig {
  return {
    version: 1,
    template: "minimal",
    elements: [],
    mapMarkers: [],
    units: { speed: "km/h", altitude: "m", coordinates: "decimal" },
    altitudeSource: "relative",
    accentColor: "#FFB020",
  };
}
