"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Pause, Play, StepBack, StepForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatTimecode } from "@/lib/telemetry/format";
import type { TelemetrySeries } from "@/lib/telemetry/series";
import { usePlaybackStore } from "@/stores/playback-store";

const RATES = [0.25, 0.5, 1, 2] as const;

/** Contiguous [start,end] video-time ranges where GPS is available, for the strip below the scrubber. */
function gpsAvailabilityRanges(series: TelemetrySeries, offsetSec: number): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let runStart: number | null = null;
  for (let i = 0; i < series.length; i++) {
    const valid = !Number.isNaN(series.latitude[i]) && !Number.isNaN(series.longitude[i]);
    if (valid && runStart === null) runStart = series.t[i];
    if (!valid && runStart !== null) {
      ranges.push([runStart + offsetSec, series.t[i - 1] + offsetSec]);
      runStart = null;
    }
  }
  if (runStart !== null) ranges.push([runStart + offsetSec, series.t[series.length - 1] + offsetSec]);
  return ranges;
}

function GpsStrip({ series, offsetSec, durationSec }: { series: TelemetrySeries | null; offsetSec: number; durationSec: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ranges = useMemo(() => (series ? gpsAvailabilityRanges(series, offsetSec) : []), [series, offsetSec]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#cdd3db";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#17803d";
    for (const [start, end] of ranges) {
      const x0 = Math.max(0, (start / durationSec) * w);
      const x1 = Math.min(w, (end / durationSec) * w);
      if (x1 > x0) ctx.fillRect(x0, 0, x1 - x0, h);
    }
  }, [ranges, durationSec]);

  return <canvas ref={canvasRef} width={800} height={6} className="h-1.5 w-full rounded-full" aria-hidden="true" />;
}

export function Timeline({
  videoRef,
  durationSec,
  fps,
  series,
  offsetSec,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  durationSec: number;
  fps: number;
  series: TelemetrySeries | null;
  offsetSec: number;
}) {
  const videoTime = usePlaybackStore((s) => s.videoTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState<number>(1);
  const frameDurSec = 1 / fps;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [videoRef]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  function stepFrame(direction: 1 | -1) {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = Math.min(durationSec, Math.max(0, video.currentTime + direction * frameDurSec));
  }

  function seekTo(t: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(durationSec, Math.max(0, t));
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => stepFrame(-1)} aria-label="Previous frame">
          <StepBack className="size-4" aria-hidden="true" />
        </Button>
        <Button size="icon" variant="default" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={() => stepFrame(1)} aria-label="Next frame">
          <StepForward className="size-4" aria-hidden="true" />
        </Button>

        <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">
          {formatTimecode(videoTime)} / {formatTimecode(durationSec)}
        </span>

        <Slider min={0} max={durationSec} step={frameDurSec} value={[videoTime]} onValueChange={([v]) => seekTo(v)} className="flex-1" />

        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            video.muted = !video.muted;
            setMuted(video.muted);
          }}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
        </Button>

        <Select
          value={String(rate)}
          onValueChange={(v) => {
            const r = Number(v);
            setRate(r);
            if (videoRef.current) videoRef.current.playbackRate = r;
          }}
        >
          <SelectTrigger className="h-8 w-16" aria-label="Playback rate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RATES.map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r}×
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <GpsStrip series={series} offsetSec={offsetSec} durationSec={durationSec} />
    </div>
  );
}
