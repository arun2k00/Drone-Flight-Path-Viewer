import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ExportShell } from "@/components/export/ExportShell";
import { SharePanel } from "@/components/share/SharePanel";
import { requirePageUser, requireProjectAccess } from "@/lib/auth/session.server";
import { prisma } from "@/lib/db.server";
import { getPublicConfig } from "@/lib/config/public-config.server";
import { AppError } from "@/lib/errors/app-error";
import { getProjectDto } from "@/lib/projects/service.server";

export default async function ExportPage({ params }: PageProps<"/projects/[projectId]/export">) {
  await connection();
  const { projectId: rawId } = await params;
  await requirePageUser(`/projects/${rawId}/export`);

  const project = await requireProjectAccess(rawId).then(getProjectDto).catch((err) => {
    if (err instanceof AppError && err.code === "PROJECT_NOT_FOUND") notFound();
    throw err;
  });

  if (project.status !== "READY") redirect(`/projects/${project.id}/analysis`);

  const publicConfig = getPublicConfig();

  return (
    <>
      <AppHeader
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: project.name }, { label: "Export" }]}
        diagnosticsEnabled={publicConfig.diagnosticsEnabled}
      />
      <PageContainer>
        <div className="mx-auto grid w-full max-w-6xl items-start gap-8 lg:grid-cols-2">
          <ExportShell project={project} diagnosticsEnabled={publicConfig.diagnosticsEnabled} />
          <SharePanel projectId={project.id} hasExport={(await prisma.renderJob.count({ where: { projectId: project.id, status: "COMPLETE" } })) > 0} />
        </div>
      </PageContainer>
    </>
  );
}
