"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TelemetryDebugRecord } from "@/types/telemetry";

/** Diagnostics-only: raw cue text and parse issues per cue, gated 404 when ENABLE_DIAGNOSTICS=false. */
export function DebugPanel({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TelemetryDebugRecord[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/telemetry/debug?offset=0&limit=200`)
      .then(async (res) => (res.ok ? ((await res.json()) as { total: number; records: TelemetryDebugRecord[] }) : null))
      .then((body) => {
        if (cancelled || !body) return;
        setRecords(body.records);
        setTotal(body.total);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs text-muted-foreground">{total} records</p>
      <ScrollArea className="h-96 rounded-lg border border-border">
        <div className="flex flex-col gap-2 p-2 font-mono text-xs">
          {records.map((r) => (
            <div key={r.cueOrdinal} className="rounded border border-border p-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>
                  cue #{r.index ?? r.cueOrdinal} · {r.status}
                </span>
                <span>{r.startTime !== null ? `${r.startTime.toFixed(3)}s` : "—"}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{r.rawText || "(empty)"}</p>
              {r.issues.length > 0 && <p className="mt-1 text-destructive">{r.issues.map((i) => i.code).join(", ")}</p>}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
