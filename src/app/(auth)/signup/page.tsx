import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/AuthForms";
import { getCurrentUser } from "@/lib/auth/session.server";
import { prisma } from "@/lib/db.server";
import { getSiteSettings } from "@/lib/site/settings.server";

export const metadata: Metadata = { title: "Create account · Aeroxpress" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/dashboard");
  const closed = !(await getSiteSettings()).signupsOpen && (await prisma.user.count()) > 0;
  return <SignupForm next={typeof next === "string" ? next : "/dashboard"} closed={closed} />;
}
