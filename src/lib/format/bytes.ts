const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Binary (1024-based) size formatting, e.g. formatBytes(4096 * 1024 * 1024) === "4 GB". */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const exponent = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return `${rounded} ${UNITS[exponent]}`;
}
