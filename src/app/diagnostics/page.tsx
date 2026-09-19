import { connection } from "next/server";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { DiagnosticsView } from "@/components/diagnostics/DiagnosticsView";
import { requireAdminPage } from "@/lib/auth/session.server";
import { getPublicConfig } from "@/lib/config/public-config.server";
import { runDiagnostics } from "@/lib/diagnostics/checks.server";

export default async function DiagnosticsPage() {
  await connection();
  await requireAdminPage();
  const [checks, publicConfig] = await Promise.all([runDiagnostics(), Promise.resolve(getPublicConfig())]);

  return (
    <>
      <AppHeader
        breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Diagnostics" }]}
        diagnosticsEnabled={publicConfig.diagnosticsEnabled}
      />
      <PageContainer className="mx-auto w-full max-w-3xl">
        <DiagnosticsView initialChecks={checks} />
      </PageContainer>
    </>
  );
}
