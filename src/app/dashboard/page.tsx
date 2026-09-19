import { connection } from "next/server";
import { CircleCheck, FileVideo, FolderOpen, LoaderCircle, Download } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { NewProjectButton } from "@/components/dashboard/NewProjectButton";
import { ProjectTable } from "@/components/dashboard/ProjectTable";
import { getPublicConfig } from "@/lib/config/public-config.server";
import { requirePageUser } from "@/lib/auth/session.server";
import { listProjects } from "@/lib/projects/service.server";

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div>
        <div className="text-2xl font-semibold tabular-nums leading-none text-foreground">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  await connection();
  const user = await requirePageUser("/dashboard");
  const [projects, publicConfig] = await Promise.all([listProjects(user.id), Promise.resolve(getPublicConfig())]);

  return (
    <>
      <AppHeader diagnosticsEnabled={publicConfig.diagnosticsEnabled} />
      <PageContainer className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Welcome, {user.name.split(" ")[0]}</h1>
            <p className="mt-1 text-muted-foreground">Your flight footage and telemetry exports.</p>
          </div>
          <NewProjectButton />
        </div>
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat icon={FileVideo} label="Projects" value={projects.length} />
          <Stat icon={CircleCheck} label="Ready to edit" value={projects.filter((p) => p.status === "READY").length} />
          <Stat icon={LoaderCircle} label="Analyzing" value={projects.filter((p) => p.status === "ANALYZING").length} />
          <Stat icon={Download} label="Exports complete" value={projects.filter((p) => p.lastExport?.status === "COMPLETE").length} />
        </div>
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No projects yet"
            description="Create a project to upload a DJI video and its SRT telemetry."
            action={<NewProjectButton />}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <ProjectTable projects={projects} />
          </div>
        )}
      </PageContainer>
    </>
  );
}
