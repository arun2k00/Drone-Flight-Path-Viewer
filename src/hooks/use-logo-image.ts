"use client";

import { useEffect, useState } from "react";

/** Loads the project's rasterized logo PNG for the overlay renderer's `assets.logo`. */
export function useLogoImage(projectId: string, hasLogo: boolean, version: number): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!hasLogo) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    fetch(`/api/projects/${projectId}/logo`)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.src = objectUrl;
        await img.decode();
        if (!cancelled) setImage(img);
      })
      .catch(() => {
        if (!cancelled) setImage(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, hasLogo, version]);

  return hasLogo ? image : null;
}
