import type { ExportSettings } from "@/types/api";

const even = (n: number): number => Math.max(2, Math.floor(n / 2) * 2);

export type OutputSizeResult = { width: number; height: number; scaled: boolean } | { error: "RESOLUTION_UNAVAILABLE" };

/** Never upscales; "original" is the source rounded down to even numbers. */
export function computeOutputSize(src: { width: number; height: number }, res: ExportSettings["resolution"]): OutputSizeResult {
  const short = Math.min(src.width, src.height);
  const fit = (target: number) => {
    const f = target / short;
    return { width: even(Math.round(src.width * f)), height: even(Math.round(src.height * f)) };
  };
  if (res === "original") {
    const w = even(src.width);
    const h = even(src.height);
    return { width: w, height: h, scaled: w !== src.width || h !== src.height };
  }
  if (res === "1080p") {
    if (short < 1080) return { error: "RESOLUTION_UNAVAILABLE" };
    const s = fit(1080);
    return { ...s, scaled: s.width !== src.width || s.height !== src.height };
  }
  if (short < 2160) return { error: "RESOLUTION_UNAVAILABLE" };
  const s = fit(2160);
  return { ...s, scaled: s.width !== src.width || s.height !== src.height };
}

export interface ResolutionOption {
  value: ExportSettings["resolution"];
  label: string;
  available: boolean;
  width: number | null;
  height: number | null;
  reason: string | null;
}

const LABELS: Record<ExportSettings["resolution"], string> = { original: "Original", "1080p": "1080p", "2160p": "4K" };

export function resolutionOptions(src: { width: number; height: number }): ResolutionOption[] {
  return (["original", "1080p", "2160p"] as const).map((value) => {
    const result = computeOutputSize(src, value);
    if ("error" in result) {
      return { value, label: LABELS[value], available: false, width: null, height: null, reason: "That resolution isn't available because the source video is smaller (no upscaling)." };
    }
    return { value, label: LABELS[value], available: true, width: result.width, height: result.height, reason: null };
  });
}
