import "server-only";
import { z } from "zod";
import { logActivity } from "@/lib/activity.server";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { adminEmails, sendEmail } from "@/lib/email/send.server";
import { emails } from "@/lib/email/templates";
import { AppError } from "@/lib/errors/app-error";
import { getSiteSettings } from "@/lib/site/settings.server";
import { hashPassword, verifyPassword } from "./crypto";
import { rateLimit } from "./rate-limit.server";
import { createSession } from "./session.server";

/** Shared by the form actions and the JSON /api/auth/session route. null = success (session cookie set). */
export interface AuthFailure {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export const emailField = z.email("Enter a valid email address.").trim().toLowerCase();
export const passwordField = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200)
  .regex(/[a-zA-Z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");
export const nameField = z.string().trim().min(2, "Enter your name.").max(80);

function fail(err: unknown): AuthFailure {
  if (err instanceof AppError) return { error: err.message };
  throw err;
}

export async function registerUser(raw: unknown): Promise<AuthFailure | null> {
  const parsed = z.object({ name: nameField, email: emailField, password: passwordField }).safeParse(raw);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const input = parsed.data;
  const config = getServerConfig();

  try {
    rateLimit(`signup:${input.email}`, 5, 60 * 60_000);
    const userCount = await prisma.user.count();
    if (userCount > 0 && !(await getSiteSettings()).signupsOpen && input.email !== config.ADMIN_EMAIL) {
      return { error: "New signups are closed right now. Contact the site administrator." };
    }
    if (await prisma.user.findUnique({ where: { email: input.email } })) {
      return { fieldErrors: { email: ["An account with this email already exists. Log in instead."] } };
    }

    // With ADMIN_EMAIL set, only that address becomes admin; otherwise the very first account does.
    const isAdmin = config.ADMIN_EMAIL ? input.email === config.ADMIN_EMAIL : userCount === 0;
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password), role: isAdmin ? "ADMIN" : "USER", lastLoginAt: new Date() },
    });
    // Projects created before accounts existed belong to the first admin.
    if (isAdmin && userCount === 0) await prisma.project.updateMany({ where: { userId: null }, data: { userId: user.id } });

    await createSession(user.id);
    await logActivity(user.id, "auth.signup", isAdmin ? "admin account" : undefined);
    void sendEmail(user.email, "welcome", emails.welcome({ appUrl: config.APP_URL, name: user.name }));
    for (const to of (await adminEmails()).filter((e) => e !== user.email)) {
      void sendEmail(to, "adminNewUser", emails.adminNewUser({ appUrl: config.APP_URL, userName: user.name, userEmail: user.email, when: user.createdAt, totalUsers: userCount + 1 }));
    }
    return null;
  } catch (err) {
    return fail(err);
  }
}

export async function authenticate(raw: unknown): Promise<AuthFailure | null> {
  const parsed = z.object({ email: emailField, password: z.string().min(1, "Enter your password.") }).safeParse(raw);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  try {
    rateLimit(`login:${parsed.data.email}`, 10, 15 * 60_000);
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    // Same message for unknown email and wrong password: no account enumeration.
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      await logActivity(user?.id ?? null, "auth.login_failed", parsed.data.email);
      return { error: "That email and password don't match." };
    }
    if (user.status !== "ACTIVE") return { error: "This account is suspended. Contact the site administrator." };
    await createSession(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await logActivity(user.id, "auth.login");
    return null;
  } catch (err) {
    return fail(err);
  }
}
