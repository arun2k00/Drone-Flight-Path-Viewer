import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Choose a new password · Aeroxpress" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || token.length < 20) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Link not valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">This reset link is incomplete. Request a new one.</p>
        <Link href="/forgot-password" className="mt-6 inline-block font-medium text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
