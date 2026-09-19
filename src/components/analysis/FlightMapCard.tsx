"use client";

import { useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { FlightMap, type FlightMapHandle } from "@/components/map/FlightMap";
import { MapStyleToggle } from "@/components/map/MapStyleToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicConfig } from "@/lib/config/public-config.server";
import { useFlightPath } from "@/hooks/use-flight-path";

export function FlightMapCard({ projectId, publicConfig }: { projectId: string; publicConfig: PublicConfig }) {
  const { data, loading, errorCode } = useFlightPath(projectId);
  const [mode, setMode] = useState<"map" | "satellite">("map");
  const mapRef = useRef<FlightMapHandle>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Flight map</CardTitle>
        <MapStyleToggle mode={mode} onModeChange={setMode} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-72 items-center justify-center text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          </div>
        ) : errorCode ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            {errorCode === "TELEMETRY_NO_GPS" ? "GPS data is unavailable in this SRT file." : "Analyze the project first."}
          </div>
        ) : (
          <FlightMap ref={mapRef} publicConfig={publicConfig} flightPath={data} mode={mode} className="h-72 overflow-hidden rounded-md" />
        )}
      </CardContent>
    </Card>
  );
}
