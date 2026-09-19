"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatAltitude, formatClock, formatCoordinate, formatHeading, formatSpeed } from "@/lib/telemetry/format";
import type { TelemetrySeries } from "@/lib/telemetry/series";

const ROW_HEIGHT = 28;

function num(arr: Float64Array, i: number): number | null {
  const v = arr[i];
  return Number.isNaN(v) ? null : v;
}

function formatDeg(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(1)}°`;
}

interface Column {
  key: string;
  label: string;
  width: string; // tailwind arbitrary width, e.g. "w-14"
  title?: string; // header tooltip, used for derived columns
  render: (series: TelemetrySeries, i: number) => string;
}

const COLUMNS: Column[] = [
  { key: "n", label: "#", width: "w-10", render: (_s, i) => String(i + 1) },
  { key: "srt", label: "SRT time", width: "w-16", render: (s, i) => s.t[i].toFixed(3) },
  {
    key: "range",
    label: "Start–end",
    width: "w-28",
    render: (s, i) => `${s.start[i].toFixed(3)}–${s.end[i].toFixed(3)}`,
  },
  { key: "lat", label: "Lat", width: "w-24", render: (s, i) => formatCoordinate(num(s.latitude, i), "lat", "decimal") },
  { key: "lon", label: "Lon", width: "w-24", render: (s, i) => formatCoordinate(num(s.longitude, i), "lon", "decimal") },
  { key: "relalt", label: "Rel alt", width: "w-16", render: (s, i) => formatAltitude(num(s.relativeAltitude, i), "m") },
  { key: "absalt", label: "Abs alt", width: "w-16", render: (s, i) => formatAltitude(num(s.absoluteAltitude, i), "m") },
  { key: "spdsrt", label: "Spd (SRT)", width: "w-20", render: (s, i) => formatSpeed(num(s.speed, i), "km/h").value },
  {
    key: "spdgps",
    label: "Spd (GPS)",
    width: "w-20",
    title: "Derived from GPS positions, not recorded by the aircraft",
    render: (s, i) => formatSpeed(num(s.groundSpeedGps, i), "km/h").value,
  },
  { key: "hdg", label: "Hdg", width: "w-14", render: (s, i) => formatHeading(num(s.heading, i)) },
  { key: "yaw", label: "Yaw", width: "w-14", render: (s, i) => formatDeg(num(s.aircraftYaw, i)) },
  { key: "gimbalp", label: "Gimbal P", width: "w-16", render: (s, i) => formatDeg(num(s.gimbalPitch, i)) },
  { key: "time", label: "Time", width: "w-20", render: (s, i) => formatClock(num(s.recordedAtMs, i)) },
];

export function TelemetryTable({ series }: { series: TelemetrySeries }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: series.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border">
      <div className="flex border-b border-border bg-muted px-2 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
        {COLUMNS.map((col) => (
          <span key={col.key} className={col.width} title={col.title}>
            {col.label}
          </span>
        ))}
      </div>
      <div ref={parentRef} className="h-96 overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((row) => (
            <div
              key={row.index}
              data-row
              className="absolute top-0 left-0 flex w-full items-center border-b border-border/50 px-2 font-mono text-xs tabular-nums text-foreground even:bg-muted/30"
              style={{ height: ROW_HEIGHT, transform: `translateY(${row.start}px)` }}
            >
              {COLUMNS.map((col) => (
                <span key={col.key} className={`${col.width} truncate`}>
                  {col.render(series, row.index)}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
