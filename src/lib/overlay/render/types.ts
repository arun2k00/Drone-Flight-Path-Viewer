import type { FlightPathGeoJson } from "@/lib/map/geojson";
import type { TelemetryProfile } from "@/lib/telemetry/profile";
import type { OverlayConfig } from "../model";

export interface RenderAssets {
  logo: CanvasImageSource | null;
  basemap: { image: CanvasImageSource; attribution: string } | null;
  flightPath: FlightPathGeoJson | null;
  /** Whole-flight altitude/speed for the graph widgets; null hides them. */
  profile: TelemetryProfile | null;
}

export interface RenderContext {
  frameWidth: number;
  frameHeight: number;
  unit: number;
  config: OverlayConfig;
  branding: { projectName: string; companyName: string | null };
  assets: RenderAssets;
}
