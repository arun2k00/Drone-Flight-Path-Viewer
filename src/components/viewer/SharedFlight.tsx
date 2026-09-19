"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { PublicConfig } from "@/lib/config/public-config.server";
import { loadLocalFlight, type LocalFlight } from "@/lib/viewer/local-flight";
import { FlightSession } from "./FlightSession";

/** Client share page: fetches the flight log once, parses it in the browser, streams the video by URL. */
export function SharedFlight({ token, publicConfig, offsetSec }: { token: string; publicConfig: PublicConfig; offsetSec: number }) {
  const [state, setState] = useState<{ flight: LocalFlight | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/s/${token}/srt`)
      .then(async (res) => {
        if (!res.ok) throw new Error("This flight log could not be loaded.");
        return loadLocalFlight(new Uint8Array(await res.arrayBuffer()));
      })
      .then(
        (flight) => !cancelled && setState({ flight, error: null }),
        (err: unknown) => !cancelled && setState({ flight: null, error: err instanceof Error ? err.message : "This flight log could not be loaded." }),
      );
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!state) {
    return (
      <p className="flex items-center justify-center gap-2 py-24 text-muted-foreground" role="status">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Loading flight…
      </p>
    );
  }
  return <FlightSession publicConfig={publicConfig} flight={state.flight} error={state.error} video={`/api/s/${token}/video`} hasSrt initialOffsetSec={offsetSec} variant="shared" />;
}
