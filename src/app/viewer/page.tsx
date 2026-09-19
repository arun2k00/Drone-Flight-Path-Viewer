import type { Metadata } from "next";
import { connection } from "next/server";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { FlightViewer } from "@/components/viewer/FlightViewer";
import { getPublicConfig } from "@/lib/config/public-config.server";

export const metadata: Metadata = { title: "Flight Viewer · Aeroxpress" };

export default async function ViewerPage() {
  await connection(); // read env at request time, not build time
  const publicConfig = getPublicConfig();
  return (
    <>
      <AppHeader breadcrumb={[{ label: "Flight Viewer" }]} diagnosticsEnabled={publicConfig.diagnosticsEnabled} />
      <PageContainer className="mx-auto w-full max-w-7xl">
        <FlightViewer publicConfig={publicConfig} />
      </PageContainer>
    </>
  );
}
