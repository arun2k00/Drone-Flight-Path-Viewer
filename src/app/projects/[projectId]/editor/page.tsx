import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { AppHeader } from "@/components/layout/AppHeader";
import { EditorShell } from "@/components/editor/EditorShell";
import { requirePageUser, requireProjectAccess } from "@/lib/auth/session.server";
import { getPublicConfig } from "@/lib/config/public-config.server";
import { AppError } from "@/lib/errors/app-error";
import { defaultOverlayConfig, withGraphWidgets } from "@/lib/overlay/templates";
import { getProjectDto, updateProject } from "@/lib/projects/service.server";

export default async function EditorPage({ params }: PageProps<"/projects/[projectId]/editor">) {
  await connection();
  const { projectId: rawId } = await params;
  await requirePageUser(`/projects/${rawId}/editor`);

  let project = await requireProjectAccess(rawId).then(getProjectDto).catch((err) => {
    if (err instanceof AppError && err.code === "PROJECT_NOT_FOUND") notFound();
    throw err;
  });

  if (project.status !== "READY") redirect(`/projects/${project.id}/analysis`);

  // First editor visit: the project starts with an empty placeholder config (no video was
  // uploaded yet at creation time). Instantiate the real default template now that the video's
  // dimensions and capabilities are known.
  if (project.overlayConfig.elements.length === 0 && project.videoMetadata && project.telemetrySummary) {
    const frame = { width: project.videoMetadata.video.width, height: project.videoMetadata.video.height };
    const ctx = {
      hasGps: project.telemetrySummary.capabilities.gps,
      hasHeading: project.telemetrySummary.capabilities.heading === "srt" || project.telemetrySettings.headingFallback === "gps-course",
      hasLogo: project.files.logo !== null,
    };
    project = await updateProject(project.id, { overlayConfig: defaultOverlayConfig(frame, ctx) });
  }

  // Configs saved before the altitude/speed graph widgets existed: add them (hidden).
  if (project.videoMetadata) {
    const withGraphs = withGraphWidgets(project.overlayConfig, { width: project.videoMetadata.video.width, height: project.videoMetadata.video.height });
    if (withGraphs !== project.overlayConfig) project = await updateProject(project.id, { overlayConfig: withGraphs });
  }

  const publicConfig = getPublicConfig();

  return (
    <>
      <AppHeader
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: project.name }, { label: "Editor" }]}
        diagnosticsEnabled={publicConfig.diagnosticsEnabled}
      />
      <EditorShell project={project} publicConfig={publicConfig} />
    </>
  );
}
