import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Reset password · Aeroxpress" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
