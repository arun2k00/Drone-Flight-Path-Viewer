import type { ParsedNumber } from "./numbers";
import type { TelemetryNumericField } from "@/types/telemetry";

export type MappedTarget = TelemetryNumericField | "frameIndex";

const ALIASES: Record<MappedTarget, readonly string[]> = {
  latitude: ["latitude", "lat", "gpslat", "gpslatitude"],
  longitude: ["longitude", "longtitude", "lon", "lng", "long", "gpslon", "gpslongitude"],
  relativeAltitude: ["relalt", "relativealt", "relativealtitude", "height", "h", "barometer"],
  absoluteAltitude: ["absalt", "absolutealt", "absolutealtitude", "altitude", "alt", "gpsalt", "altitudemsl"],
  speed: ["speed", "groundspeed", "hspeed", "horizontalspeed", "hs"],
  speedX: ["dronespeedx", "speedx", "vx", "velocityx", "velx"],
  speedY: ["dronespeedy", "speedy", "vy", "velocityy", "vely"],
  speedZ: ["dronespeedz", "speedz", "vz", "velocityz", "velz", "vspeed", "verticalspeed", "vs"],
  heading: ["heading", "hdg", "compass"],
  aircraftYaw: ["droneyaw", "yaw", "aircraftyaw"],
  aircraftPitch: ["dronepitch", "pitch", "aircraftpitch"],
  aircraftRoll: ["droneroll", "roll", "aircraftroll"],
  gimbalYaw: ["gbyaw", "gimbalyaw"],
  gimbalPitch: ["gbpitch", "gimbalpitch"],
  gimbalRoll: ["gbroll", "gimbalroll"],
  frameIndex: ["framecnt", "srtcnt"],
};

const ALIAS_TO_TARGET = new Map<string, MappedTarget>(
  (Object.entries(ALIASES) as [MappedTarget, readonly string[]][]).flatMap(([target, keys]) => keys.map((k) => [k, target] as const)),
);

export const CORE_TARGETS: ReadonlySet<MappedTarget> = new Set(["latitude", "longitude", "relativeAltitude", "absoluteAltitude"]);
const SPEED_TARGETS: ReadonlySet<MappedTarget> = new Set(["speed", "speedX", "speedY", "speedZ"]);
const ALT_TARGETS: ReadonlySet<MappedTarget> = new Set(["relativeAltitude", "absoluteAltitude"]);

/** key.toLowerCase().replace(/[^a-z0-9]/g, ""), so "rel_alt" → "relalt", "H.S" → "hs". */
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function mapKey(normalizedKey: string): MappedTarget | null {
  return ALIAS_TO_TARGET.get(normalizedKey) ?? null;
}

/** Converts a parsed value + unit to SI (m/s, metres) for the given target field. */
export function toSi(target: MappedTarget, parsed: ParsedNumber): number {
  if (SPEED_TARGETS.has(target)) {
    if (parsed.unit === "km/h") return parsed.value / 3.6;
    if (parsed.unit === "mph") return parsed.value * 0.44704;
    if (parsed.unit === "kn" || parsed.unit === "kt") return parsed.value * 0.514444;
  }
  if (ALT_TARGETS.has(target) && parsed.unit === "ft") return parsed.value * 0.3048;
  return parsed.value;
}
