import type { ExportSettings } from "@/types/api";

/** CRF 18/21/24 for high/balanced/small; libx264 medium preset is the fixed baseline. */
export const CRF_BY_QUALITY: Record<ExportSettings["quality"], number> = { high: 18, balanced: 21, small: 24 };

export const VIDEO_CODEC_ARGS = ["-c:v", "libx264", "-preset", "medium", "-profile:v", "high", "-pix_fmt", "yuv420p"] as const;

export const COLOR_ALLOW = {
  primaries: ["bt709", "bt2020", "smpte170m", "bt470bg"],
  transfer: ["bt709", "arib-std-b67", "smpte2084", "smpte170m", "bt470bg", "iec61966-2-1"],
  space: ["bt709", "bt2020nc", "smpte170m", "bt470bg"],
} as const;
