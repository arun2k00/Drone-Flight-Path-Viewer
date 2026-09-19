"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEditorStore } from "@/stores/editor-store";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** 2 "Nothing selected" panel — units/altitude-source come from overlayConfig, the rest from telemetrySettings. */
export function TelemetrySettingsPanel() {
  const speedSource = useEditorStore((s) => s.telemetrySettings.speedSource);
  const headingFallback = useEditorStore((s) => s.telemetrySettings.headingFallback);
  const setTelemetrySettings = useEditorStore((s) => s.setTelemetrySettings);
  const units = useEditorStore((s) => s.config.units);
  const altitudeSource = useEditorStore((s) => s.config.altitudeSource);
  const setUnits = useEditorStore((s) => s.setUnits);
  const setAltitudeSource = useEditorStore((s) => s.setAltitudeSource);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold text-foreground">Project settings</h2>

      <Field label="Speed unit" htmlFor="speed-unit">
        <Select value={units.speed} onValueChange={(v) => setUnits({ speed: v as typeof units.speed })}>
          <SelectTrigger id="speed-unit" className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="km/h">km/h</SelectItem>
            <SelectItem value="m/s">m/s</SelectItem>
            <SelectItem value="mph">mph</SelectItem>
            <SelectItem value="kn">kn</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Altitude unit" htmlFor="altitude-unit">
        <Select value={units.altitude} onValueChange={(v) => setUnits({ altitude: v as typeof units.altitude })}>
          <SelectTrigger id="altitude-unit" className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="m">m</SelectItem>
            <SelectItem value="ft">ft</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Coordinate format" htmlFor="coord-format">
        <Select value={units.coordinates} onValueChange={(v) => setUnits({ coordinates: v as typeof units.coordinates })}>
          <SelectTrigger id="coord-format" className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="decimal">Decimal</SelectItem>
            <SelectItem value="dms">DMS</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Altitude source" htmlFor="altitude-source">
        <Select value={altitudeSource} onValueChange={(v) => setAltitudeSource(v as typeof altitudeSource)}>
          <SelectTrigger id="altitude-source" className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relative">Relative</SelectItem>
            <SelectItem value="absolute">Absolute</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Speed source" htmlFor="speed-source">
        <Select value={speedSource} onValueChange={(v) => setTelemetrySettings({ speedSource: v as "auto" | "srt-only" })}>
          <SelectTrigger id="speed-source" className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="srt-only">SRT only</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Heading fallback" htmlFor="heading-fallback">
        <Select value={headingFallback} onValueChange={(v) => setTelemetrySettings({ headingFallback: v as "none" | "gps-course" })}>
          <SelectTrigger id="heading-fallback" className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="gps-course">GPS course (TRK)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
