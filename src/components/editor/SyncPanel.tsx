"use client";

import { RotateCcw } from "lucide-react";
import { SyncCard } from "@/components/analysis/SyncCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useEditorStore } from "@/stores/editor-store";
import type { SyncReport } from "@/types/telemetry";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

export function SyncPanel({ fps, syncReport }: { fps: number; syncReport: SyncReport | null }) {
  const offsetSec = useEditorStore((s) => s.telemetrySettings.offsetSec);
  const setTelemetrySettings = useEditorStore((s) => s.setTelemetrySettings);
  const frameDurSec = 1 / fps;

  const setOffset = (v: number) => setTelemetrySettings({ offsetSec: clamp(round2(v), -30, 30) });

  return (
    <div className="flex flex-col gap-4">
      {syncReport && <SyncCard sync={syncReport} />}

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="offset-slider" className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Offset
          </Label>
          <Button variant="ghost" size="sm" onClick={() => setOffset(0)} disabled={offsetSec === 0}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setOffset(offsetSec - frameDurSec)}>
            −1 frame
          </Button>
          <Slider
            id="offset-slider"
            min={-5}
            max={5}
            step={0.1}
            value={[clamp(offsetSec, -5, 5)]}
            onValueChange={([v]) => setOffset(v)}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={() => setOffset(offsetSec + frameDurSec)}>
            +1 frame
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="number"
            step={0.01}
            min={-30}
            max={30}
            value={offsetSec}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setOffset(v);
            }}
            className="h-8 w-28 font-mono tabular-nums"
          />
          <span className="text-sm text-muted-foreground">seconds</span>
        </div>

        <p className="text-xs text-muted-foreground">Positive values make telemetry appear later.</p>
      </div>
    </div>
  );
}
