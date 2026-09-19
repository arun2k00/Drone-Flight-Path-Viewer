"use client";

import { useEffect, useState } from "react";

const REFETCH_DEBOUNCE_MS = 500;

export interface BasemapAsset {
  image: HTMLImageElement;
  attribution: string;
}

/** debounced refetch 500 ms after the mini-map's aspect/size stops changing. */
export function useBasemap(
  projectId: string,
  style: "none" | "map" | "satellite",
  aspect: number,
  widthPx: number,
  paddingRatio: number,
): BasemapAsset | null {
  const [asset, setAsset] = useState<BasemapAsset | null>(null);

  useEffect(() => {
    if (style === "none") return;

    let cancelled = false;
    let objectUrl: string | null = null;

    const timer = setTimeout(() => {
      const url = `/api/projects/${projectId}/basemap?style=${style}&aspect=${aspect.toFixed(3)}&width=${Math.round(widthPx)}&padding=${paddingRatio}`;
      fetch(url)
        .then(async (res) => {
          if (!res.ok || cancelled) return;
          const attribution = decodeURIComponent(res.headers.get("X-Basemap-Attribution") ?? "");
          const blob = await res.blob();
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.src = objectUrl;
          await img.decode();
          if (!cancelled) setAsset({ image: img, attribution });
        })
        .catch(() => {
          if (!cancelled) setAsset(null);
        });
    }, REFETCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, style, aspect, widthPx, paddingRatio]);

  return style === "none" ? null : asset;
}
