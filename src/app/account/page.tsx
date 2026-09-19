import type { Metadata } from "next";
import { connection } from "next/server";
import { PasswordForm, ProfileForm } from "@/components/auth/AccountForms";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { requirePageUser } from "@/lib/auth/session.server";
import { getPublicConfig } from "@/lib/config/public-config.server";

export const metadata: Metadata = { title: "Account · Aeroxpress" };

export default async function AccountPage() {
  await connection();
  const user = await requirePageUser("/account");
  return (
    <>
      <AppHeader breadcrumb={[{ label: "Account" }]} diagnosticsEnabled={getPublicConfig().diagnosticsEnabled} />
      <PageContainer className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">Account settings</h1>
          <p className="mt-1 text-muted-foreground">Manage your profile and sign-in details.</p>
        </div>
        <ProfileForm name={user.name} email={user.email} />
        <PasswordForm />
      </PageContainer>
    </>
  );
}
