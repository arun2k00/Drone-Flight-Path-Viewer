import { formatDuration as formatDurationBase } from "@/lib/format/duration";

const MISSING = "—";

export type SpeedUnit = "m/s" | "km/h" | "mph" | "kn";
export type AltitudeUnit = "m" | "ft";
export type CoordinateAxis = "lat" | "lon";
export type CoordinateStyle = "decimal" | "dms";

export function formatSpeed(mps: number | null, unit: SpeedUnit): { value: string; unit: SpeedUnit } {
  if (mps === null) return { value: MISSING, unit };
  const factor = unit === "km/h" ? 3.6 : unit === "mph" ? 2.2369362920544 : unit === "kn" ? 1.9438444924574 : 1;
  return { value: (mps * factor).toFixed(1), unit };
}

export function formatAltitude(m: number | null, unit: AltitudeUnit): string {
  if (m === null) return MISSING;
  return unit === "ft" ? (m / 0.3048).toFixed(0) : m.toFixed(1);
}

function formatDms(deg: number, axis: CoordinateAxis): string {
  const hemisphere = axis === "lat" ? (deg >= 0 ? "N" : "S") : deg >= 0 ? "E" : "W";
  const abs = Math.abs(deg);
  const degrees = Math.floor(abs);
  const minutesFull = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFull);
  const seconds = (minutesFull - minutes) * 60;
  return `${degrees}°${String(minutes).padStart(2, "0")}'${seconds.toFixed(1).padStart(4, "0")}"${hemisphere}`;
}

export function formatCoordinate(deg: number | null, axis: CoordinateAxis, style: CoordinateStyle): string {
  if (deg === null) return MISSING;
  return style === "dms" ? formatDms(deg, axis) : deg.toFixed(6);
}

/** "127°", zero-padded to 3 digits ("007°"). */
export function formatHeading(deg: number | null): string {
  if (deg === null) return MISSING;
  return `${String(Math.round(deg)).padStart(3, "0")}°`;
}

/** UTC getters on the naive recordedAtMs timestamp — it carries no real timezone. */
export function formatClock(recordedAtMs: number | null): string {
  if (recordedAtMs === null) return MISSING;
  const d = new Date(recordedAtMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function formatDuration(sec: number | null): string {
  return sec === null ? MISSING : formatDurationBase(sec);
}

/** "04:52.533" (editor timeline). */
export function formatTimecode(sec: number | null): string {
  return sec === null ? MISSING : formatDurationBase(sec, { milliseconds: true });
}

/** Worst-case strings for stable panel layout (content-fit sizing never jitters between frames). */
export const WORST_CASE_STRINGS = {
  latitude: "-89.999999",
  longitude: "-179.999999",
  altitude: "-9999.9",
  speed: "999.9",
  heading: "359°",
  clock: "23:59:59",
  units: "km/h",
} as const;
