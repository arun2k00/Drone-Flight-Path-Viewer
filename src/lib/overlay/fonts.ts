export const OVERLAY_FONTS = [
  { family: "DTS Sans Regular", file: "IBMPlexSans-Regular.woff2" },
  { family: "DTS Sans Medium", file: "IBMPlexSans-Medium.woff2" },
  { family: "DTS Sans SemiBold", file: "IBMPlexSans-SemiBold.woff2" },
  { family: "DTS Mono Regular", file: "IBMPlexMono-Regular.woff2" },
  { family: "DTS Mono Medium", file: "IBMPlexMono-Medium.woff2" },
] as const;

export type OverlayFontFamily = (typeof OVERLAY_FONTS)[number]["family"];

export const font = (family: OverlayFontFamily, px: number): string => `${Math.max(1, px).toFixed(2)}px "${family}"`;
