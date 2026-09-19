import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CircleAlert } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { AnalysisTabs } from "@/components/analysis/AnalysisTabs";
import { DebugPanel } from "@/components/analysis/DebugPanel";
import { FlightMapCard } from "@/components/analysis/FlightMapCard";
import { SyncCard } from "@/components/analysis/SyncCard";
import { TelemetryCard } from "@/components/analysis/TelemetryCard";
import { VideoCard } from "@/components/analysis/VideoCard";
import { WarningsList } from "@/components/analysis/WarningsList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageUser, requireProjectAccess } from "@/lib/auth/session.server";
import { getPublicConfig } from "@/lib/config/public-config.server";
import { AppError } from "@/lib/errors/app-error";
import { formatBytes } from "@/lib/format/bytes";
import { getProjectDto } from "@/lib/projects/service.server";
import { loadFlightPath } from "@/lib/telemetry/persistence.server";

export default async function AnalysisPage({ params }: PageProps<"/projects/[projectId]/analysis">) {
  await connection();
  const { projectId: rawId } = await params;
  await requirePageUser(`/projects/${rawId}/analysis`);

  const project = await requireProjectAccess(rawId).then(getProjectDto).catch((err) => {
    if (err instanceof AppError && err.code === "PROJECT_NOT_FOUND") notFound();
    throw err;
  });

  const publicConfig = getPublicConfig();
  const statusVariant = project.status === "READY" ? undefined : project.status === "ERROR" ? "destructive" : "secondary";

  const pathVertices = project.telemetrySummary
    ? await loadFlightPath(project.id)
        .then((flightPath) => {
          const pathFeature = flightPath.features.find((f) => f.properties.kind === "path");
          return pathFeature && pathFeature.properties.kind === "path"
            ? { source: pathFeature.properties.sourcePointCount, simplified: pathFeature.geometry.coordinates.length }
            : null;
        })
        .catch(() => null)
    : null;

  const overview = (
    <div className="grid gap-4 lg:grid-cols-2">
      {project.videoMetadata && project.files.video ? (
        <div className="flex flex-col gap-4">
          <VideoCard metadata={project.videoMetadata} />
          <video
            controls
            preload="metadata"
            className="w-full rounded-lg border border-border bg-black"
            src={`/api/projects/${project.id}/video`}
          />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Video</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">No video uploaded yet.</CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {project.telemetrySummary ? (
          <TelemetryCard summary={project.telemetrySummary} pathVertices={pathVertices} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Telemetry</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {project.files.telemetry ? (
                <div className="flex items-baseline justify-between gap-2 font-mono text-sm tabular-nums">
                  <span className="truncate text-foreground">{project.files.telemetry.originalName}</span>
                  <span className="shrink-0 text-muted-foreground">{formatBytes(project.files.telemetry.sizeBytes)}</span>
                </div>
              ) : (
                <p className="text-muted-foreground">No SRT telemetry uploaded yet.</p>
              )}
            </CardContent>
          </Card>
        )}
        {project.syncReport && <SyncCard sync={project.syncReport} />}
        {project.telemetrySummary && <FlightMapCard projectId={project.id} publicConfig={publicConfig} />}
      </div>
    </div>
  );

  return (
    <>
      <AppHeader
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: project.name }, { label: "Analysis" }]}
        diagnosticsEnabled={publicConfig.diagnosticsEnabled}
      />
      <PageContainer className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{project.name}</h1>
            {project.companyName && <p className="text-sm text-muted-foreground">{project.companyName}</p>}
          </div>
          <Badge
            variant={statusVariant === "destructive" ? "destructive" : statusVariant === "secondary" ? "secondary" : "default"}
            className={statusVariant === undefined ? "border-success/40 bg-success/10 text-success" : undefined}
          >
            {project.status}
          </Badge>
        </div>

        {project.status === "ERROR" && project.error && (
          <Alert variant="destructive" className="mb-4">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Analysis failed</AlertTitle>
            <AlertDescription>{project.error.message}</AlertDescription>
          </Alert>
        )}

        {project.telemetrySummary && <WarningsList warnings={project.telemetrySummary.warnings} />}

        <AnalysisTabs
          projectId={project.id}
          overview={overview}
          hasTelemetry={project.telemetrySummary !== null}
          debug={publicConfig.diagnosticsEnabled && project.telemetrySummary ? <DebugPanel projectId={project.id} /> : undefined}
        />

        <div className="mt-6 flex justify-end">
          {project.status === "READY" ? (
            <Button asChild>
              <Link href={`/projects/${project.id}/editor`}>Continue to editor</Link>
            </Button>
          ) : (
            <Button disabled>Continue to editor</Button>
          )}
        </div>
      </PageContainer>
    </>
  );
}
