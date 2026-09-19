import { CircleAlert, CircleCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCoordinate } from "@/lib/telemetry/format";
import type { TelemetrySummary } from "@/types/telemetry";

function CapabilityRow({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="flex items-center gap-2 text-foreground">
        {ok ? (
          <CircleCheck className="size-3.5 text-success" aria-hidden="true" />
        ) : (
          <CircleAlert className="size-3.5 text-muted-foreground" aria-hidden="true" />
        )}
        {label}
      </span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}

function formatPathLength(meters: number | null, vertices: { source: number; simplified: number } | null): string {
  if (meters === null) return "—";
  const distance = meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters.toFixed(1)} m`;
  return vertices ? `${distance} · ${vertices.source.toLocaleString()} → ${vertices.simplified.toLocaleString()} vertices` : distance;
}

export function TelemetryCard({
  summary,
  pathVertices,
}: {
  summary: TelemetrySummary;
  pathVertices?: { source: number; simplified: number } | null;
}) {
  const { capabilities } = summary;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Telemetry</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 font-mono text-sm tabular-nums text-muted-foreground">
          <span>{summary.sampleCount.toLocaleString()} points</span>
          <span aria-hidden="true">·</span>
          <span>{summary.estimatedRateHz ? `${summary.estimatedRateHz.toFixed(1)} Hz` : "—"}</span>
          <span aria-hidden="true">·</span>
          <span>{summary.parserId}</span>
        </div>

        <div className="divide-y divide-border rounded-md border border-border">
          <CapabilityRow label="GPS" ok={capabilities.gps} />
          <CapabilityRow label="Altitude (relative)" ok={capabilities.relativeAltitude} />
          <CapabilityRow label="Altitude (absolute)" ok={capabilities.absoluteAltitude} />
          <CapabilityRow
            label="Speed"
            ok={capabilities.speed !== "none"}
            note={capabilities.speed === "gps-derived" ? "derived from GPS" : undefined}
          />
          <CapabilityRow
            label="Heading"
            ok={capabilities.heading !== "none"}
            note={capabilities.heading === "none" ? "not recorded by this aircraft" : undefined}
          />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-sm tabular-nums sm:grid-cols-3">
          <Field
            label="Start"
            value={
              summary.firstFix
                ? `${formatCoordinate(summary.firstFix.latitude, "lat", "decimal")}, ${formatCoordinate(summary.firstFix.longitude, "lon", "decimal")}`
                : "—"
            }
          />
          <Field
            label="End"
            value={
              summary.lastFix
                ? `${formatCoordinate(summary.lastFix.latitude, "lat", "decimal")}, ${formatCoordinate(summary.lastFix.longitude, "lon", "decimal")}`
                : "—"
            }
          />
          <Field
            label="Altitude range"
            value={
              summary.relativeAltitudeRange
                ? `${summary.relativeAltitudeRange.min.toFixed(1)}–${summary.relativeAltitudeRange.max.toFixed(1)} m`
                : "—"
            }
          />
          <Field label="Max speed" value={summary.maxSpeedMps !== null ? `${(summary.maxSpeedMps * 3.6).toFixed(1)} km/h` : "—"} />
          <Field label="Path length" value={formatPathLength(summary.pathLengthMeters, pathVertices ?? null)} />
          <Field label="Time range" value={`${summary.timeRange.start.toFixed(1)}s – ${summary.timeRange.end.toFixed(1)}s`} />
        </div>
      </CardContent>
    </Card>
  );
}
