"use client";

import { OVERLAY_FONTS } from "./fonts";

let fontsPromise: Promise<void> | null = null;

/** The overlay stage awaits this before its first draw, so no fallback-font frame ever appears. */
export function loadOverlayFonts(): Promise<void> {
  fontsPromise ??= Promise.all(
    OVERLAY_FONTS.map(async ({ family, file }) => {
      const face = new FontFace(family, `url(/fonts/${file})`);
      await face.load();
      document.fonts.add(face);
    }),
  ).then(() => undefined);
  return fontsPromise;
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}
