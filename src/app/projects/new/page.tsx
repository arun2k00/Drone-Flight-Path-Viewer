import { connection } from "next/server";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { NewProjectForm } from "@/components/upload/NewProjectForm";
import { requirePageUser } from "@/lib/auth/session.server";
import { getPublicConfig } from "@/lib/config/public-config.server";

export default async function NewProjectPage() {
  await connection();
  await requirePageUser("/projects/new");
  const publicConfig = getPublicConfig();

  return (
    <>
      <AppHeader
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "New Project" }]}
        diagnosticsEnabled={publicConfig.diagnosticsEnabled}
      />
      <PageContainer className="mx-auto w-full max-w-3xl">
        <h1 className="mb-6 text-lg font-semibold text-foreground">New Project</h1>
        <NewProjectForm
          maxVideoBytes={publicConfig.uploadLimits.maxVideoMb * 1024 * 1024}
          maxSrtBytes={publicConfig.uploadLimits.maxSrtMb * 1024 * 1024}
        />
      </PageContainer>
    </>
  );
}
