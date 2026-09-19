import "server-only";
import { getServerConfig } from "./env.server";

export interface PublicConfig {
  map: {
    styleUrl: string | null;
    satelliteStyleUrl: string | null;
    /** OSM raster style for interactive viewing only — never used server-side for burned-in maps. */
    fallbackRaster: { tiles: string[]; attribution: string; maxzoom: number };
    /** Esri World Imagery raster, used when NEXT_PUBLIC_SATELLITE_STYLE_URL is empty (interactive viewing only). */
    fallbackSatellite: { tiles: string[]; attribution: string; maxzoom: number };
  };
  overlayBasemaps: { map: boolean; satellite: boolean };
  diagnosticsEnabled: boolean;
  uploadLimits: { maxVideoMb: number; maxSrtMb: number; maxLogoMb: number; chunkSizeMb: number };
}

export function getPublicConfig(): PublicConfig {
  const config = getServerConfig();
  return {
    map: {
      styleUrl: config.NEXT_PUBLIC_MAP_STYLE_URL,
      satelliteStyleUrl: config.NEXT_PUBLIC_SATELLITE_STYLE_URL,
      fallbackRaster: {
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        attribution: "© OpenStreetMap contributors",
        maxzoom: 19,
      },
      fallbackSatellite: {
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
        maxzoom: 19,
      },
    },
    overlayBasemaps: {
      map: config.OVERLAY_MAP_TILE_URL !== null,
      satellite: config.OVERLAY_SATELLITE_TILE_URL !== null,
    },
    diagnosticsEnabled: config.ENABLE_DIAGNOSTICS,
    uploadLimits: {
      maxVideoMb: config.MAX_VIDEO_SIZE_MB,
      maxSrtMb: config.MAX_SRT_SIZE_MB,
      maxLogoMb: config.MAX_LOGO_SIZE_MB,
      chunkSizeMb: config.UPLOAD_CHUNK_SIZE_MB,
    },
  };
}
