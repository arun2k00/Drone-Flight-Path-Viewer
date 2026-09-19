"use client";

import { useEffect, useState } from "react";
import type { FlightPathGeoJson } from "@/lib/map/geojson";

export function useFlightPath(projectId: string): { data: FlightPathGeoJson | null; loading: boolean; errorCode: string | null } {
  const [data, setData] = useState<FlightPathGeoJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/projects/${projectId}/flight-path`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as (FlightPathGeoJson & { error?: never }) | { error: { code: string } } | null;
        if (cancelled) return;
        if (!res.ok) {
          setErrorCode((body as { error?: { code: string } } | null)?.error?.code ?? "INTERNAL_ERROR");
          return;
        }
        setData(body as FlightPathGeoJson);
        setErrorCode(null);
      })
      .catch(() => {
        if (!cancelled) setErrorCode("INTERNAL_ERROR");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { data, loading, errorCode };
}
