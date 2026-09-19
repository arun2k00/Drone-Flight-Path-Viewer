import type { TelemetryInterpolator, InterpolatedTelemetry } from "@/lib/telemetry/interpolator";
import type { TelemetryCapabilities, TelemetrySettings } from "@/types/telemetry";

export interface DisplayValues {
  altitude: number | null;
  speedMps: number | null;
  speedSource: "srt" | "srt-components" | "gps-derived" | null;
  heading: number | null;
  headingSource: "srt" | "gps-course" | null;
  latitude: number | null;
  longitude: number | null;
  recordedAtMs: number | null;
}

export interface FrameState {
  videoTime: number;
  telemetry: InterpolatedTelemetry;
  display: DisplayValues;
}

/** The single place that resolves offset/altitude-source/speed-source/heading-fallback into display values. */
export function buildFrameState(
  videoTime: number,
  interpolator: TelemetryInterpolator,
  settings: TelemetrySettings,
  config: { altitudeSource: "relative" | "absolute" },
  capabilities: TelemetryCapabilities,
): FrameState {
  const t = interpolator.getAtTime(videoTime - settings.offsetSec);
  const speedFromSrt = t.speed;
  const derived = settings.speedSource === "auto" ? t.groundSpeedGps : null;
  return {
    videoTime,
    telemetry: t,
    display: {
      altitude: config.altitudeSource === "relative" ? t.relativeAltitude : t.absoluteAltitude,
      speedMps: speedFromSrt ?? derived,
      speedSource:
        speedFromSrt !== null
          ? capabilities.speed === "srt-components"
            ? "srt-components"
            : "srt"
          : derived !== null
            ? "gps-derived"
            : null,
      heading: t.heading ?? (settings.headingFallback === "gps-course" ? t.courseGps : null),
      headingSource: t.heading !== null ? "srt" : settings.headingFallback === "gps-course" && t.courseGps !== null ? "gps-course" : null,
      latitude: t.latitude,
      longitude: t.longitude,
      recordedAtMs: t.recordedAtMs,
    },
  };
}
