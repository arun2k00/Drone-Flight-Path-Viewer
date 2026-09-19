"use client";

import { useEffect, useState } from "react";
import { seriesFromJson, type TelemetrySeries, type TelemetrySeriesJson } from "@/lib/telemetry/series";
import type { TelemetrySummary } from "@/types/telemetry";

export interface TelemetryData {
  summary: TelemetrySummary;
  series: TelemetrySeries;
}

interface TelemetryPayloadJson {
  version: 1;
  summary: TelemetrySummary;
  series: TelemetrySeriesJson;
}

/** Fetches GET /api/projects/{id}/telemetry once and memoizes the parsed series (seriesFromJson runs only on load). */
export function useTelemetry(projectId: string): { data: TelemetryData | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/projects/${projectId}/telemetry`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as (TelemetryPayloadJson & { error?: never }) | { error: { message: string } } | null;
        if (!res.ok) throw new Error((body as { error?: { message: string } } | null)?.error?.message ?? "Failed to load telemetry.");
        return body as TelemetryPayloadJson;
      })
      .then((payload) => {
        if (cancelled) return;
        setData({ summary: payload.summary, series: seriesFromJson(payload.series) });
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load telemetry.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { data, loading, error };
}
