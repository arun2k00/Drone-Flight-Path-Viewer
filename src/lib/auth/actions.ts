"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity.server";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { sendEmail } from "@/lib/email/send.server";
import { emails } from "@/lib/email/templates";
import { AppError } from "@/lib/errors/app-error";
import { hashPassword, sha256, verifyPassword } from "./crypto";
import { rateLimit } from "./rate-limit.server";
import { authenticate, emailField, nameField, passwordField, registerUser } from "./service.server";
import { startPasswordReset } from "./reset.server";
import { createSession, destroySession, requireUser } from "./session.server";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  /** Echoed non-secret inputs, so React's post-action form reset doesn't wipe what the user typed. */
  values?: Record<string, string>;
}

const keep = (form: FormData, ...names: string[]) => Object.fromEntries(names.map((n) => [n, String(form.get(n) ?? "")]));

const email = emailField;
const password = passwordField;
const name = nameField;

/** Only same-site paths, so ?next= can't redirect to another origin. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}

function fail(err: unknown): FormState {
  if (err instanceof AppError) return { error: err.message };
  throw err;
}

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const failure = await registerUser(Object.fromEntries(form));
  if (failure) return { ...failure, values: keep(form, "name", "email") };
  redirect(safeNext(form.get("next")));
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const failure = await authenticate(Object.fromEntries(form));
  if (failure) return { ...failure, values: keep(form, "email") };
  redirect(safeNext(form.get("next")));
}

export async function logoutAction(): Promise<void> {
  const user = await requireUser().catch(() => null);
  await destroySession();
  if (user) await logActivity(user.id, "auth.logout");
  redirect("/");
}

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: keep(form, "email") };
  try {
    rateLimit(`forgot:${parsed.data.email}`, 3, 60 * 60_000);
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (user?.status === "ACTIVE") {
      await startPasswordReset(user.id);
      await logActivity(user.id, "auth.password_reset_requested");
    }
  } catch (err) {
    return fail(err);
  }
  return { message: "If an account exists for that email, a reset link is on its way. It expires in 60 minutes." };
}

async function setPassword(userId: string, newPassword: string): Promise<void> {
  const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
  await prisma.session.deleteMany({ where: { userId } }); // sign out every other device
  await createSession(userId);
  void sendEmail(user.email, "passwordChanged", emails.passwordChanged({ appUrl: getServerConfig().APP_URL, name: user.name, when: new Date() }));
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ token: z.string().min(20), password }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const id = sha256(parsed.data.token);
  // Claim the token atomically so two concurrent submissions can't both use it.
  const claimed = await prisma.passwordReset.updateMany({ where: { id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  const reset = claimed.count === 1 ? await prisma.passwordReset.findUnique({ where: { id }, include: { user: true } }) : null;
  if (!reset || reset.user.status !== "ACTIVE") {
    return { error: "This reset link has expired or was already used. Request a new one." };
  }
  await setPassword(reset.userId, parsed.data.password);
  await logActivity(reset.userId, "auth.password_reset");
  redirect("/dashboard");
}

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ name }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values: keep(form, "name") };
  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  await logActivity(user.id, "account.profile_updated");
  return { message: "Profile saved.", values: { name: parsed.data.name } };
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ currentPassword: z.string().min(1, "Enter your current password."), password }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    rateLimit(`chpw:${user.id}`, 5, 15 * 60_000);
  } catch (err) {
    return fail(err);
  }
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(parsed.data.currentPassword, row.passwordHash))) return { fieldErrors: { currentPassword: ["That's not your current password."] } };
  await setPassword(user.id, parsed.data.password);
  await logActivity(user.id, "account.password_changed");
  return { message: "Password changed. Other devices were signed out." };
}
