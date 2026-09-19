"use client";

import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TelemetryInspector } from "@/components/telemetry/TelemetryInspector";
import { TelemetryTable } from "@/components/telemetry/TelemetryTable";
import { TimeProbe } from "@/components/telemetry/TimeProbe";
import { useTelemetry } from "@/hooks/use-telemetry";

export function AnalysisTabs({
  projectId,
  overview,
  debug,
  hasTelemetry,
}: {
  projectId: string;
  overview: ReactNode;
  debug?: ReactNode;
  hasTelemetry: boolean;
}) {
  // Fetched once here (not per tab), so switching Telemetry <-> Inspector never re-fetches.
  const { data, loading, error } = useTelemetry(projectId);

  return (
    <Tabs defaultValue="overview" className="mt-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="telemetry" disabled={!hasTelemetry}>
          Telemetry
        </TabsTrigger>
        <TabsTrigger value="inspector" disabled={!hasTelemetry}>
          Inspector
        </TabsTrigger>
        {debug && <TabsTrigger value="debug">Debug</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview">{overview}</TabsContent>

      <TabsContent value="telemetry" className="flex flex-col gap-4">
        {!hasTelemetry ? null : loading ? (
          <LoadingRow />
        ) : error ? (
          <p className="py-6 text-sm text-destructive">{error}</p>
        ) : data ? (
          <>
            <TimeProbe series={data.series} />
            <TelemetryTable series={data.series} />
          </>
        ) : null}
      </TabsContent>

      <TabsContent value="inspector">
        {!hasTelemetry ? null : loading ? (
          <LoadingRow />
        ) : error ? (
          <p className="py-6 text-sm text-destructive">{error}</p>
        ) : data ? (
          <TelemetryInspector summary={data.summary} />
        ) : null}
      </TabsContent>

      {debug && <TabsContent value="debug">{debug}</TabsContent>}
    </Tabs>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
    </div>
  );
}
