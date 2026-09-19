"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { GeoJSONSource, LngLatBoundsLike, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { FrameState } from "@/lib/overlay/frame-state";
import type { PublicConfig } from "@/lib/config/public-config.server";
import { splitPathAtTime, type FlightPathGeoJson } from "@/lib/map/geojson";
import type { MapMarker } from "@/lib/overlay/model";

const FLOWN_UPDATE_THROTTLE_MS = 250;

export interface FlightMapHandle {
  fitToPath(): void;
  /** [lng, lat] of the drone marker, or null if it hasn't been placed. Dev debug handle uses this too. */
  getDroneLngLat(): [number, number] | null;
  /** Moves the drone marker/flown line to match the playback clock. */
  updateDrone(frame: FrameState): void;
}

export interface FlightMapProps {
  publicConfig: PublicConfig;
  flightPath: FlightPathGeoJson | null;
  mapMarkers?: MapMarker[];
  mode: "map" | "satellite";
  accentColor?: string;
  className?: string;
  /** When set, clicking the map calls this instead of the default pan/zoom-only behavior ("+ Map marker" mode). */
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
}

const DEFAULT_ACCENT = "#FFB020";

function resolveStyle(mode: "map" | "satellite", publicConfig: PublicConfig): StyleSpecification | string {
  if (mode === "satellite" && publicConfig.map.satelliteStyleUrl) return publicConfig.map.satelliteStyleUrl;
  if (mode === "map" && publicConfig.map.styleUrl) return publicConfig.map.styleUrl;
  const { tiles, attribution, maxzoom } = mode === "satellite" ? publicConfig.map.fallbackSatellite : publicConfig.map.fallbackRaster;
  return {
    version: 8,
    sources: { base: { type: "raster", tiles: [...tiles], tileSize: 256, maxzoom, attribution } },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}

function pathFeatureOf(flightPath: FlightPathGeoJson | null) {
  return flightPath?.features.find((f) => f.properties.kind === "path") ?? null;
}

const DOT_SVG =
  '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<circle cx="10" cy="10" r="9" fill="#111418" stroke="white" stroke-width="2"/>' +
  '<circle cx="10" cy="10" r="3" fill="white"/>' +
  "</svg>";

const ARROW_SVG =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M12 2 L20 20 L12 15.5 L4 20 Z" fill="#111418" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>' +
  "</svg>";

function droneMarkerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "width:28px;height:28px;display:flex;align-items:center;justify-content:center;pointer-events:none;";
  el.innerHTML = DOT_SVG;
  return el;
}

function markerElementOf(label: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;pointer-events:none;transform:translateY(4px);";
  el.innerHTML =
    '<svg width="18" height="22" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M9 21C9 21 16 13.5 16 8A7 7 0 0 0 2 8C2 13.5 9 21 9 21Z" fill="#FFB020" stroke="#111418" stroke-width="1.5"/>' +
    '<circle cx="9" cy="8" r="2.5" fill="#111418"/>' +
    "</svg>" +
    `<span style="margin-top:2px;padding:1px 5px;border-radius:3px;background:rgba(12,14,17,0.85);color:#F3F5F7;font-size:10px;font-family:'IBM Plex Sans',sans-serif;white-space:nowrap;">${escapeHtml(label)}</span>`;
  return el;
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function addPathLayers(map: MapLibreMap, flightPath: FlightPathGeoJson, accentColor: string): void {
  const pathFeature = pathFeatureOf(flightPath);
  if (!pathFeature) return;

  if (!map.getSource("dts-path")) {
    map.addSource("dts-path", { type: "geojson", data: pathFeature as unknown as GeoJSON.Feature });
  }
  if (!map.getSource("dts-flown")) {
    map.addSource("dts-flown", {
      type: "geojson",
      data: { type: "LineString", coordinates: [] } as unknown as GeoJSON.Geometry,
    });
  }
  if (!map.getSource("dts-points")) {
    const startEnd = flightPath.features.filter((f): f is Extract<typeof f, { properties: { kind: "start" | "end" } }> =>
      f.properties.kind === "start" || f.properties.kind === "end",
    );
    map.addSource("dts-points", { type: "geojson", data: { type: "FeatureCollection", features: startEnd } as unknown as GeoJSON.FeatureCollection });
  }

  if (!map.getLayer("dts-path-casing")) {
    map.addLayer({
      id: "dts-path-casing",
      type: "line",
      source: "dts-path",
      paint: { "line-color": "#000000", "line-opacity": 0.5, "line-width": 5 },
    });
  }
  if (!map.getLayer("dts-path")) {
    map.addLayer({ id: "dts-path", type: "line", source: "dts-path", paint: { "line-color": "#ffffff", "line-width": 3 } });
  }
  if (!map.getLayer("dts-flown")) {
    map.addLayer({ id: "dts-flown", type: "line", source: "dts-flown", paint: { "line-color": accentColor, "line-width": 3.5 } });
  }
  if (!map.getLayer("dts-start")) {
    map.addLayer({
      id: "dts-start",
      type: "circle",
      source: "dts-points",
      filter: ["==", ["get", "kind"], "start"],
      paint: { "circle-radius": 6, "circle-color": "#17803d", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" },
    });
  }
  if (!map.getLayer("dts-end")) {
    map.addLayer({
      id: "dts-end",
      type: "circle",
      source: "dts-points",
      filter: ["==", ["get", "kind"], "end"],
      paint: { "circle-radius": 6, "circle-color": "#d1302a", "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" },
    });
  }
}

function boundsOfPath(flightPath: FlightPathGeoJson): LngLatBoundsLike | null {
  return flightPath.bbox ? [[flightPath.bbox[0], flightPath.bbox[1]], [flightPath.bbox[2], flightPath.bbox[3]]] : null;
}

export const FlightMap = forwardRef<FlightMapHandle, FlightMapProps>(function FlightMap(
  { publicConfig, flightPath, mapMarkers = [], mode, accentColor = DEFAULT_ACCENT, className, onMapClick },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const droneMarkerRef = useRef<import("maplibre-gl").Marker | null>(null);
  const droneMarkerModeRef = useRef<"dot" | "arrow" | null>(null);
  const lastFlownUpdateMsRef = useRef(0);
  const flownRef = useRef<[number, number][]>([]); // re-applied after a style switch wipes custom sources
  const onMapClickRef = useRef(onMapClick);
  const markerObjectsRef = useRef(new Map<string, import("maplibre-gl").Marker>());
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [gpsUnavailable, setGpsUnavailable] = useState(false);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useImperativeHandle(ref, () => ({
    fitToPath() {
      const map = mapRef.current;
      if (!map || !flightPath) return;
      const bounds = boundsOfPath(flightPath);
      if (bounds) map.fitBounds(bounds, { padding: 48, animate: false, maxZoom: 18 });
    },
    getDroneLngLat() {
      const lngLat = droneMarkerRef.current?.getLngLat();
      return lngLat ? [lngLat.lng, lngLat.lat] : null;
    },
    updateDrone(frame) {
      const map = mapRef.current;
      const marker = droneMarkerRef.current;
      const { latitude, longitude, heading } = frame.display;

      if (latitude === null || longitude === null) {
        setGpsUnavailable(true);
        marker?.getElement().style.setProperty("display", "none");
        return;
      }
      setGpsUnavailable(false);

      const markerMode = heading !== null ? "arrow" : "dot";
      if (marker) {
        marker.getElement().style.removeProperty("display");
        if (droneMarkerModeRef.current !== markerMode) {
          marker.getElement().innerHTML = markerMode === "arrow" ? ARROW_SVG : DOT_SVG;
          droneMarkerModeRef.current = markerMode;
        }
        marker.setLngLat([longitude, latitude]);
        if (heading !== null) marker.setRotation(heading);
      }

      // Derived from the path + time (not accumulated), so scrubbing backwards shortens the flown line.
      const now = performance.now();
      if (map && flightPath && now - lastFlownUpdateMsRef.current >= FLOWN_UPDATE_THROTTLE_MS) {
        lastFlownUpdateMsRef.current = now;
        const { flown } = splitPathAtTime(flightPath, frame.telemetry.srtTime, [longitude, latitude]);
        flownRef.current = flown as [number, number][];
        const source = map.getSource("dts-flown") as GeoJSONSource | undefined;
        source?.setData({ type: "LineString", coordinates: flownRef.current });
      }
    },
  }));

  // Init once. Re-created only if the container or path presence changes identity (not on mode — see the style effect below).
  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const maplibregl = await import("maplibre-gl");
      maplibregl.setWorkerUrl(`/vendor/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);
      if (cancelled || !containerRef.current) return;

      const pathFeature = pathFeatureOf(flightPath);
      const startLngLat = pathFeature?.geometry.coordinates[0] as [number, number] | undefined;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: resolveStyle(mode, publicConfig),
        attributionControl: { compact: true },
        center: startLngLat ?? [0, 0],
        zoom: startLngLat ? 15 : 1,
      });
      mapRef.current = map;

      // The container can still be 0×0 when the map is created (MapLibre then falls back to 400×300),
      // so keep the drawing buffer in step with the container's real size.
      let userMoved = false;
      map.on("movestart", (e) => {
        if ((e as { originalEvent?: unknown }).originalEvent) userMoved = true;
      });
      const resizeObserver = new ResizeObserver(() => {
        map.resize();
        const bounds = flightPath && !userMoved ? boundsOfPath(flightPath) : null;
        if (bounds) map.fitBounds(bounds, { padding: 48, animate: false, maxZoom: 18 });
      });
      resizeObserver.observe(containerRef.current);
      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
      map.on("error", () => setStatus("error"));
      map.on("click", (e) => onMapClickRef.current?.(e.lngLat));

      const onStyleReady = () => {
        if (flightPath) {
          addPathLayers(map, flightPath, accentColor);
          const bounds = boundsOfPath(flightPath);
          if (bounds) map.fitBounds(bounds, { padding: 48, animate: false, maxZoom: 18 });

          if (startLngLat && !droneMarkerRef.current) {
            droneMarkerRef.current = new maplibregl.Marker({
              element: droneMarkerElement(),
              rotationAlignment: "map",
              pitchAlignment: "map",
            })
              .setLngLat(startLngLat)
              .addTo(map);
            droneMarkerModeRef.current = "dot";
          }
        }
        setStatus("ready");
      };
      map.on("load", onStyleReady);
      map.on("style.load", () => {
        // Custom sources/layers are lost on setStyle; re-add them. addPathLayers guards each
        // add with getSource/getLayer checks, so this is a no-op on the very first "style.load"
        // that precedes onStyleReady's own (identical) add. isStyleLoaded() is NOT a reliable
        // gate here — it can still read false at the instant "style.load" fires.
        if (!flightPath) return;
        addPathLayers(map, flightPath, accentColor);
        (map.getSource("dts-flown") as GeoJSONSource | undefined)?.setData({ type: "LineString", coordinates: flownRef.current });
      });

      if (process.env.NODE_ENV !== "production") {
        (window as unknown as Record<string, unknown>).__dtsFlightMap = {
          querySourceFeatures: (sourceId: string) => map.querySourceFeatures(sourceId),
          getDroneLngLat: () => {
            const lngLat = droneMarkerRef.current?.getLngLat();
            return lngLat ? [lngLat.lng, lngLat.lat] : null;
          },
        };
      }

      cleanup = () => {
        resizeObserver.disconnect();
        droneMarkerRef.current?.remove();
        droneMarkerRef.current = null;
        for (const marker of markerObjectsRef.current.values()) marker.remove();
        markerObjectsRef.current.clear();
        map.remove();
        mapRef.current = null;
      };
    })().catch(() => setStatus("error"));

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-init only when the flight path itself changes; `mode` is handled by the effect below.
  }, [flightPath]);

  // Switch style in place when mode changes, without tearing down the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(resolveStyle(mode, publicConfig));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- publicConfig is stable for the lifetime of the page.
  }, [mode]);

  // Crosshair cursor while "+ Map marker" mode is active.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.cursor = onMapClick ? "crosshair" : "";
  }, [onMapClick]);

  // Keep MapLibre Markers in sync with config.mapMarkers (create/update/remove by id).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    let cancelled = false;

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled) return;
      const existing = markerObjectsRef.current;
      const nextIds = new Set(mapMarkers.map((m) => m.id));

      for (const [id, marker] of existing) {
        if (!nextIds.has(id)) {
          marker.remove();
          existing.delete(id);
        }
      }

      for (const marker of mapMarkers) {
        const el = markerElementOf(marker.label);
        let instance = existing.get(marker.id);
        if (!instance) {
          instance = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([marker.longitude, marker.latitude]).addTo(map);
          existing.set(marker.id, instance);
        } else {
          instance.setLngLat([marker.longitude, marker.latitude]);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [mapMarkers, status]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={containerRef} className="h-full w-full" />
      {gpsUnavailable && (
        <div className="absolute top-2 left-2 z-10 rounded bg-card/90 px-2 py-1 text-[11px] font-medium text-destructive shadow">
          GPS UNAVAILABLE
        </div>
      )}
      {status === "error" && <p className="p-2 text-xs text-destructive">The map failed to load.</p>}
    </div>
  );
});
