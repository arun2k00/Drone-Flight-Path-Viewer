"use client";

import { useId, useMemo, useRef } from "react";
import { formatTimecode } from "@/lib/telemetry/format";
import { valueRange } from "@/lib/telemetry/profile";

const W = 1000;
const H = 100;

/**
 * Whole-flight line chart with a cursor. The path is built once per data set; only the cursor
 * moves as the video plays. Click or drag to seek; arrow keys step 1 s (Shift: 10 s).
 */
export function FlightChart({
  label,
  unit,
  scale = 1,
  t,
  values,
  time,
  onSeek,
}: {
  label: string;
  unit: string;
  /** Multiplier from the stored SI value to the displayed unit (m/s → km/h = 3.6). */
  scale?: number;
  t: Float64Array;
  values: Float64Array;
  time: number;
  onSeek: (t: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const clipId = useId();
  const t0 = t[0] ?? 0;
  const t1 = t[t.length - 1] ?? 0;
  const span = Math.max(1e-6, t1 - t0);

  const chart = useMemo(() => {
    const range = valueRange(values);
    if (!range) return null;
    const pad = Math.max((range.max - range.min) * 0.1, 0.5 / scale);
    const lo = range.min - pad;
    const hi = range.max + pad;
    const x = (v: number) => (((v - t0) / span) * W).toFixed(1);
    const y = (v: number) => (H - ((v - lo) / (hi - lo)) * H).toFixed(1);
    let line = "";
    let area = "";
    for (let i = 0; i < values.length; i++) {
      if (!Number.isFinite(values[i])) continue;
      const startsRun = i === 0 || !Number.isFinite(values[i - 1]);
      line += `${startsRun ? "M" : "L"}${x(t[i])} ${y(values[i])}`;
      if (startsRun) area += `M${x(t[i])} ${H}`;
      area += `L${x(t[i])} ${y(values[i])}`;
      if (i === values.length - 1 || !Number.isFinite(values[i + 1])) area += `L${x(t[i])} ${H}Z`;
    }
    return { line, area, min: range.min * scale, max: range.max * scale };
  }, [t, values, t0, span, scale]);

  const frac = Math.min(1, Math.max(0, (time - t0) / span));
  let current: number | null = null;
  for (let i = 0; i < t.length && t[i] <= time; i++) current = Number.isFinite(values[i]) ? values[i] : null;

  function seekTo(clientX: number) {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    onSeek(t0 + Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * span);
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums text-foreground">
          {current === null ? "—" : (current * scale).toFixed(1)} <span className="text-muted-foreground">{unit}</span>
        </span>
      </div>
      {chart ? (
        <div
          ref={boxRef}
          role="slider"
          tabIndex={0}
          aria-label={`${label} over the flight`}
          aria-valuemin={t0}
          aria-valuemax={t1}
          aria-valuenow={time}
          aria-valuetext={formatTimecode(time)}
          className="relative h-24 cursor-pointer touch-none rounded-lg bg-muted/60 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            seekTo(e.clientX);
          }}
          onPointerMove={(e) => e.buttons === 1 && seekTo(e.clientX)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 10 : 1;
            if (e.key === "ArrowRight") onSeek(Math.min(t1, time + step));
            else if (e.key === "ArrowLeft") onSeek(Math.max(t0, time - step));
            else return;
            e.preventDefault();
          }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="-10" width={frac * W} height={H + 20} />
              </clipPath>
            </defs>
            <path d={chart.line} fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.45" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <g clipPath={`url(#${clipId})`}>
              <path d={chart.area} fill="var(--primary)" fillOpacity="0.14" />
              <path d={chart.line} fill="none" stroke="var(--primary)" strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${frac * 100}%` }} />
          <span className="pointer-events-none absolute top-1 left-2 font-mono text-[10px] text-muted-foreground">{chart.max.toFixed(0)}</span>
          <span className="pointer-events-none absolute bottom-1 left-2 font-mono text-[10px] text-muted-foreground">{chart.min.toFixed(0)}</span>
        </div>
      ) : (
        <p className="rounded-lg bg-muted/60 px-3 py-6 text-center text-sm text-muted-foreground">This flight log has no {label.toLowerCase()} data.</p>
      )}
    </div>
  );
}
