import { CircleAlert, CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import { formatCoordinate } from "@/lib/telemetry/format";
import type { TelemetrySummary } from "@/types/telemetry";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

function Availability({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="flex items-center gap-1 text-success">
      <CircleCheck className="size-3.5" aria-hidden="true" />
      Available
    </span>
  ) : (
    <span className="flex items-center gap-1 text-muted-foreground">
      <CircleAlert className="size-3.5" aria-hidden="true" />
      Not available
    </span>
  );
}

/** spec fields. */
export function TelemetryInspector({ summary }: { summary: TelemetrySummary }) {
  const { capabilities } = summary;
  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      <Row label="Samples" value={summary.sampleCount.toLocaleString()} />
      <Row label="GPS" value={<Availability ok={capabilities.gps} />} />
      <Row label="Altitude" value={<Availability ok={capabilities.relativeAltitude || capabilities.absoluteAltitude} />} />
      <Row label="Speed" value={<Availability ok={capabilities.speed !== "none"} />} />
      <Row label="Heading" value={<Availability ok={capabilities.heading !== "none"} />} />
      <Row
        label="Start coordinates"
        value={
          summary.firstFix
            ? `${formatCoordinate(summary.firstFix.latitude, "lat", "decimal")}, ${formatCoordinate(summary.firstFix.longitude, "lon", "decimal")}`
            : "—"
        }
      />
      <Row
        label="End coordinates"
        value={
          summary.lastFix
            ? `${formatCoordinate(summary.lastFix.latitude, "lat", "decimal")}, ${formatCoordinate(summary.lastFix.longitude, "lon", "decimal")}`
            : "—"
        }
      />
      <Row label="GPS coverage" value={`${Math.round(summary.gpsCoverage * 100)}%`} />
      <Row label="Rate" value={summary.estimatedRateHz ? `${summary.estimatedRateHz.toFixed(1)} Hz` : "—"} />
      <Row label="Parser" value={`${summary.parserId} v${summary.parserVersion}`} />
      <Row label="Unknown fields" value={summary.report.unknownKeys.length > 0 ? summary.report.unknownKeys.join(", ") : "None"} />
    </div>
  );
}
