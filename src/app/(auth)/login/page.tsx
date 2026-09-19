import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/AuthForms";
import { getCurrentUser } from "@/lib/auth/session.server";

export const metadata: Metadata = { title: "Log in · Aeroxpress" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : "/dashboard";
  if (await getCurrentUser()) redirect(target.startsWith("/") && !target.startsWith("//") ? target : "/dashboard");
  return <LoginForm next={target} />;
}
