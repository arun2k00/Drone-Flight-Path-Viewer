"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlightMap, type FlightMapHandle } from "@/components/map/FlightMap";
import { MapStyleToggle } from "@/components/map/MapStyleToggle";
import { useVideoClock } from "@/components/video/useVideoClock";
import type { PublicConfig } from "@/lib/config/public-config.server";
import { buildFrameState } from "@/lib/overlay/frame-state";
import { formatCoordinate, formatHeading, formatTimecode } from "@/lib/telemetry/format";
import { computeSyncReport } from "@/lib/telemetry/sync";
import { cn } from "@/lib/utils";
import { nearestTimeTo, type LocalFlight } from "@/lib/viewer/local-flight";
import { DEFAULT_TELEMETRY_SETTINGS } from "@/types/telemetry";
import { FlightChart } from "./FlightChart";

const UI_UPDATE_MS = 100; // React re-renders at ≤10 Hz; the map marker follows every video frame.

const card = "rounded-xl border border-border bg-card shadow-sm";

export interface FlightSessionProps {
  publicConfig: PublicConfig;
  flight: LocalFlight | null;
  error: string | null;
  /** A local File (played via an object URL, never read into memory) or a URL (share links). */
  video: File | string | null;
  hasSrt: boolean;
  initialOffsetSec?: number;
  /** "local": the drop-files viewer, with offset controls and pairing hints. "shared": a client's read-only view. */
  variant?: "local" | "shared";
}

/** Video + map + timeline + graphs + telemetry, all driven by one clock. Used by /viewer and the client share page. */
export function FlightSession({ publicConfig, flight, error, video: source, hasSrt, initialOffsetSec = 0, variant = "local" }: FlightSessionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mapRef = useRef<FlightMapHandle>(null);
  const [codecError, setCodecError] = useState(false);
  const [mode, setMode] = useState<"map" | "satellite">("map");
  const [offsetSec, setOffsetSec] = useState(initialOffsetSec); // srtTime = videoTime − offset; DJI SRT cues are on the video clock, so 0 by default
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [srtTime, setSrtTime] = useState(flight?.summary.timeRange.start ?? 0);
  const lastUiUpdate = useRef(0);

  const [graphs, setGraphs] = useState({ altitude: true, speed: false });

  // Object URL, never FileReader: a multi-GB video stays on disk and is streamed by the browser.
  useEffect(() => {
    const video = videoRef.current;
    if (!source || !video) return;
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    video.src = url;
    return () => {
      video.removeAttribute("src");
      if (typeof source !== "string") URL.revokeObjectURL(url);
    };
  }, [source]);

  const frameAt = (t: number) =>
    flight &&
    buildFrameState(t + offsetSec, flight.interpolator, { ...DEFAULT_TELEMETRY_SETTINGS, offsetSec }, { altitudeSource: "relative" }, flight.summary.capabilities);

  function show(t: number, force: boolean) {
    const frame = frameAt(t);
    if (frame) mapRef.current?.updateDrone(frame);
    const now = performance.now();
    if (force || now - lastUiUpdate.current >= UI_UPDATE_MS) {
      lastUiUpdate.current = now;
      setSrtTime(t);
    }
  }

  useVideoClock(videoRef, (videoTime, reason) => show(videoTime - offsetSec, reason !== "frame"));

  // An offset change keeps the video where it is and moves the telemetry under it.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const id = setTimeout(() => show(video.currentTime - offsetSec, true), 0);
    return () => clearTimeout(id);
  }, [offsetSec]); // eslint-disable-line react-hooks/exhaustive-deps -- only on offset change

  /** Single entry point for timeline drags and map clicks: seeks the video when there is one. */
  function seek(t: number) {
    const video = videoRef.current;
    if (video && !codecError) video.currentTime = Math.max(0, t + offsetSec);
    show(t, true);
  }

  const frame = frameAt(srtTime);
  const range = flight?.summary.timeRange ?? { start: 0, end: 0 };
  const hasVideo = source !== null;
  const syncMessages =
    flight && videoDuration
      ? computeSyncReport({
          videoDurationSec: videoDuration,
          fps: 30, // browsers don't expose fps; only affects the ±2-frame tolerance
          videoFrameCount: null,
          telemetry: flight.summary,
          cueBounds: { start: Float64Array.from(flight.points, (p) => p.startTime), end: Float64Array.from(flight.points, (p) => p.endTime) },
          offsetSec,
        }).messages.filter((m) => m.code !== "TELEMETRY_GAPS")
      : [];
  const status =
    error ??
    (variant === "shared"
      ? null
      : !hasSrt
        ? "Video loaded. Add the matching SRT file to display the flight path."
        : !hasVideo && flight?.flightPath
          ? "Flight path loaded. Add the matching video to synchronize playback."
          : null);

  return (
    <div className="flex flex-col gap-4">
      {status && (
        <p className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", error ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground")} role="status">
          {error && <TriangleAlert className="size-4" aria-hidden="true" />}
          {status}
        </p>
      )}

      <div className={cn("grid gap-4", hasVideo && "lg:grid-cols-2")}>
        {hasVideo && (
          <div className={cn(card, "overflow-hidden")}>
            {codecError ? (
              <p className="flex aspect-video items-center justify-center bg-muted p-6 text-center text-muted-foreground">
                Your browser cannot play this video format, but the flight path and telemetry are still available.
              </p>
            ) : (
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full bg-black"
                onError={() => setCodecError(true)}
                onLoadedMetadata={(e) => {
                  if (e.currentTarget.videoWidth === 0) setCodecError(true); // e.g. HEVC in a browser without HEVC: audio only
                  setVideoDuration(e.currentTarget.duration);
                }}
              />
            )}
          </div>
        )}

        {flight && (
          <div className={cn(card, "relative overflow-hidden")}>
            {flight.flightPath ? (
              <>
                <FlightMap
                  ref={mapRef}
                  publicConfig={publicConfig}
                  flightPath={flight.flightPath}
                  mode={mode}
                  accentColor="#c2560c"
                  className={hasVideo ? "aspect-video" : "h-[55vh] min-h-72"}
                  onMapClick={({ lat, lng }) => {
                    const t = nearestTimeTo(flight.points, lat, lng);
                    if (t !== null) seek(t);
                  }}
                />
                <div className="absolute bottom-8 right-2 z-10 flex gap-2">
                  <Button size="sm" variant="outline" className="bg-card" onClick={() => mapRef.current?.fitToPath()}>
                    Fit flight
                  </Button>
                  <MapStyleToggle mode={mode} onModeChange={setMode} />
                </div>
              </>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center">
                <TriangleAlert className="size-6 text-warning" aria-hidden="true" />
                <p className="font-medium">GPS data wasn&rsquo;t found in this flight log.</p>
                <p className="max-w-md text-muted-foreground">
                  {flight.noGpsMessage} Some DJI recording modes write SRT telemetry without usable GPS, for example when there was no satellite fix.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {flight && (
        <>
          <div className={cn(card, "flex flex-col gap-2 p-4")}>
            <div className="flex items-center gap-3">
              <span className="w-14 font-mono tabular-nums text-muted-foreground">{formatTimecode(range.start)}</span>
              <input
                type="range"
                aria-label="Flight timeline"
                className="flex-1 accent-primary"
                min={range.start}
                max={range.end}
                step={0.01}
                value={srtTime}
                onChange={(e) => seek(Number(e.target.value))}
              />
              <span className="w-14 text-right font-mono tabular-nums text-muted-foreground">{formatTimecode(range.end)}</span>
            </div>
            {variant === "local" && syncMessages.map((m) => (
              <p key={m.code} className="text-xs text-warning">
                {m.message} Use the telemetry offset if the marker drifts from the video.
              </p>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Flight time <span className="font-mono text-foreground tabular-nums">{formatTimecode(srtTime)}</span>
              </span>
              {hasVideo && variant === "local" && (
                <span className="flex items-center gap-1">
                  Telemetry offset
                  <Button size="icon-sm" variant="outline" aria-label="Decrease offset" onClick={() => setOffsetSec((o) => Math.round((o - 0.1) * 10) / 10)}>
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-12 text-center font-mono text-foreground tabular-nums">
                    {offsetSec > 0 ? "+" : ""}
                    {offsetSec.toFixed(1)}s
                  </span>
                  <Button size="icon-sm" variant="outline" aria-label="Increase offset" onClick={() => setOffsetSec((o) => Math.round((o + 0.1) * 10) / 10)}>
                    <Plus className="size-3" />
                  </Button>
                </span>
              )}
            </div>
          </div>

          <section className={cn(card, "flex flex-col gap-3 p-4")} aria-label="Flight graphs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Flight profile</h2>
              <div className="flex gap-2" role="group" aria-label="Graphs to show">
                {(["altitude", "speed"] as const).map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={graphs[key] ? "default" : "outline"}
                    aria-pressed={graphs[key]}
                    onClick={() => setGraphs((g) => ({ ...g, [key]: !g[key] }))}
                  >
                    {key === "altitude" ? "Altitude" : "Speed"}
                  </Button>
                ))}
              </div>
            </div>
            {graphs.altitude && (
              <FlightChart
                label="Altitude"
                unit="m"
                t={flight.profile.t}
                values={flight.stats.relativeAltitude ? flight.profile.relativeAltitude : flight.profile.absoluteAltitude}
                time={srtTime}
                onSeek={seek}
              />
            )}
            {graphs.speed && (
              <FlightChart
                label={flight.summary.capabilities.speed === "gps-derived" ? "Speed (GPS-derived)" : "Speed"}
                unit="km/h"
                scale={3.6}
                t={flight.profile.t}
                values={flight.profile.speed}
                time={srtTime}
                onSeek={seek}
              />
            )}
            {!graphs.altitude && !graphs.speed && <p className="text-sm text-muted-foreground">Pick a graph to show altitude or speed across the whole flight.</p>}
          </section>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="GPS points" value={flight.stats.gpsPoints.toLocaleString()} />
            <Stat label="Flight distance" value={flight.stats.distanceMeters === null ? "—" : formatDistance(flight.stats.distanceMeters)} />
            <Stat label="Flight duration" value={formatDurationShort(flight.stats.durationSec)} />
            <Stat
              label={flight.stats.relativeAltitude ? "Altitude (relative)" : "Altitude (absolute)"}
              value={formatRange(flight.stats.relativeAltitude ?? flight.stats.absoluteAltitude)}
              sub={flight.stats.relativeAltitude && flight.stats.absoluteAltitude ? `Absolute ${formatRange(flight.stats.absoluteAltitude)}` : undefined}
            />
          </div>

          {frame && <TelemetryPanel flight={flight} frame={frame} />}
        </>
      )}
    </div>
  );
}

function TelemetryPanel({ flight, frame }: { flight: LocalFlight; frame: NonNullable<ReturnType<typeof buildFrameState>> }) {
  const t = frame.telemetry;
  const d = frame.display;
  const cam = flight.camera[t.sampleIndex] ?? {};
  const rows: Array<[string, string | null]> = [
    ["Time", formatTimecode(t.srtTime)],
    ["Latitude", d.latitude === null ? null : formatCoordinate(d.latitude, "lat", "decimal")],
    ["Longitude", d.longitude === null ? null : formatCoordinate(d.longitude, "lon", "decimal")],
    ["Altitude (rel.)", t.relativeAltitude === null ? null : `${t.relativeAltitude.toFixed(1)} m`],
    ["Altitude (abs.)", t.absoluteAltitude === null ? null : `${t.absoluteAltitude.toFixed(1)} m`],
    ["Speed" + (d.speedSource === "gps-derived" ? " (GPS-derived)" : ""), d.speedMps === null ? null : `${d.speedMps.toFixed(1)} m/s`],
    ["Heading", d.heading === null ? null : formatHeading(d.heading)],
    ["ISO", cam.iso ?? null],
    ["Shutter", cam.shutter ?? null],
    ["Aperture", cam.aperture ?? null],
    ["Focal length", cam.focalLength ?? null],
    ["EV", cam.ev ?? null],
  ];
  return (
    <section className={cn(card, "p-4")} aria-label="Flight telemetry">
      <h2 className="mb-3 font-semibold">Flight telemetry</h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {rows
          .filter(([, v]) => v !== null)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-mono tabular-nums">{v}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={cn(card, "p-4")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

function formatDurationShort(sec: number) {
  const s = Math.round(sec);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

function formatRange(r: { min: number; max: number } | null) {
  return r ? `${Math.round(r.min)} m — ${Math.round(r.max)} m` : "—";
}
