"use client";

import { formatAltitude, formatClock, formatCoordinate, formatHeading, formatSpeed, type AltitudeUnit, type CoordinateStyle, type SpeedUnit } from "@/lib/telemetry/format";
import { usePlaybackStore } from "@/stores/playback-store";

function Field({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div>
      <p className="font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="font-mono text-lg tabular-nums text-foreground">
        {value}
        {badge && <span className="ml-1.5 align-middle text-[10px] font-sans font-medium uppercase text-muted-foreground">{badge}</span>}
      </p>
    </div>
  );
}

const SPEED_BADGE: Record<string, string> = { srt: "", "srt-components": "", "gps-derived": "GPS" };
const HEADING_BADGE: Record<string, string> = { srt: "", "gps-course": "TRK" };

export function TelemetryReadout({
  offsetSec,
  altitudeUnit = "m",
  speedUnit = "km/h",
  coordinateFormat = "decimal",
}: {
  offsetSec: number;
  altitudeUnit?: AltitudeUnit;
  speedUnit?: SpeedUnit;
  coordinateFormat?: CoordinateStyle;
}) {
  const display = usePlaybackStore((s) => s.display);
  const videoTime = usePlaybackStore((s) => s.videoTime);
  const srtTime = videoTime - offsetSec;

  return (
    <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 sm:grid-cols-4">
      <Field label="Altitude" value={display ? formatAltitude(display.altitude, altitudeUnit) : "—"} />
      <Field
        label="Speed"
        value={display ? formatSpeed(display.speedMps, speedUnit).value : "—"}
        badge={display?.speedSource ? SPEED_BADGE[display.speedSource] : undefined}
      />
      <div className="col-span-2 sm:col-span-1">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Position</p>
        {display && display.latitude !== null && display.longitude !== null ? (
          <p className="font-mono text-sm tabular-nums text-foreground">
            {formatCoordinate(display.latitude, "lat", coordinateFormat)}, {formatCoordinate(display.longitude, "lon", coordinateFormat)}
          </p>
        ) : (
          <p className="font-mono text-sm text-destructive">GPS UNAVAILABLE</p>
        )}
      </div>
      <Field
        label="Heading"
        value={display ? formatHeading(display.heading) : "—"}
        badge={display?.headingSource ? HEADING_BADGE[display.headingSource] : undefined}
      />
      <Field label="Time" value={display ? formatClock(display.recordedAtMs) : "—"} />
      <Field label="SRT time" value={`${srtTime.toFixed(3)}s`} />
    </div>
  );
}
