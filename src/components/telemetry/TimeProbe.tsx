"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatAltitude, formatClock, formatCoordinate, formatHeading, formatSpeed } from "@/lib/telemetry/format";
import { createInterpolator } from "@/lib/telemetry/interpolator";
import type { TelemetrySeries } from "@/lib/telemetry/series";

/** Display-only bracket lookup on the raw sample times (separate from the interpolator's per-field gap logic). */
function bracketInfo(t: Float64Array, time: number): { i: number; f: number } | null {
  if (t.length === 0 || time < t[0] || time > t[t.length - 1]) return null;
  let lo = 0;
  let hi = t.length - 1;
  let k = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= time) {
      k = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (k >= t.length - 1) return { i: k, f: 0 };
  return { i: k, f: (time - t[k]) / (t[k + 1] - t[k]) };
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-sans text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}

export function TimeProbe({ series }: { series: TelemetrySeries }) {
  const interpolator = useMemo(() => createInterpolator(series), [series]);
  const { range } = interpolator;
  const [time, setTime] = useState(range.start);
  const [offsetSec, setOffsetSec] = useState(0);

  const probeTime = time + offsetSec;
  const sample = interpolator.getAtTime(probeTime);
  const bracket = bracketInfo(series.t, probeTime);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center gap-3">
        <Label htmlFor="time-probe-slider" className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Time probe
        </Label>
        <Slider
          id="time-probe-slider"
          min={range.start}
          max={range.end}
          step={0.001}
          value={[time]}
          onValueChange={([v]) => setTime(v)}
          className="flex-1"
        />
        <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">{time.toFixed(3)}s</span>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="time-probe-offset" className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Offset (s)
        </Label>
        <Input
          id="time-probe-offset"
          type="number"
          step={0.01}
          value={offsetSec}
          onChange={(e) => setOffsetSec(Number(e.target.value) || 0)}
          className="h-7 w-24"
        />
      </div>

      {!sample.inRange ? (
        <p className="text-sm text-muted-foreground">— Outside telemetry range</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 font-mono text-sm tabular-nums sm:grid-cols-6">
            <Field label="Alt" value={formatAltitude(sample.relativeAltitude, "m")} />
            <Field label="Spd (SRT)" value={formatSpeed(sample.speed, "km/h").value} />
            <Field label="Spd (GPS)" value={formatSpeed(sample.groundSpeedGps, "km/h").value} />
            <Field label="Lat" value={formatCoordinate(sample.latitude, "lat", "decimal")} />
            <Field label="Lon" value={formatCoordinate(sample.longitude, "lon", "decimal")} />
            <Field label="Hdg" value={formatHeading(sample.heading)} />
            <Field label="Time" value={formatClock(sample.recordedAtMs)} />
          </div>
          {bracket && (
            <p className="text-xs text-muted-foreground">
              between samples #{bracket.i + 1} and #{Math.min(bracket.i + 2, series.length)} (f = {bracket.f.toFixed(2)})
            </p>
          )}
        </>
      )}
    </div>
  );
}
