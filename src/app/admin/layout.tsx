import type { Metadata } from "next";
import { connection } from "next/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { AppHeader } from "@/components/layout/AppHeader";
import { requireAdminPage } from "@/lib/auth/session.server";
import { getPublicConfig } from "@/lib/config/public-config.server";

export const metadata: Metadata = { title: "Admin · Aeroxpress" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  await requireAdminPage();
  return (
    <>
      <AppHeader breadcrumb={[{ label: "Admin", href: "/admin" }]} diagnosticsEnabled={getPublicConfig().diagnosticsEnabled} />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <aside className="lg:w-52 lg:shrink-0">
          <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground lg:block">Admin console</p>
          <AdminNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
