"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity.server";
import type { FormState } from "@/lib/auth/actions";
import { startPasswordReset } from "@/lib/auth/reset.server";
import { requireAdmin } from "@/lib/auth/session.server";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { sendEmail } from "@/lib/email/send.server";
import { emails } from "@/lib/email/templates";
import { deleteProject } from "@/lib/projects/service.server";
import { revokeShareLink } from "@/lib/share/service.server";
import { saveSiteSettings, siteSettingsSchema } from "@/lib/site/settings.server";

const userId = z.uuid();

/** Admins can't lock themselves out: no self-suspend, self-demote or self-delete. */
async function targetUser(rawId: unknown) {
  const admin = await requireAdmin();
  const id = userId.parse(rawId);
  if (id === admin.id) throw new Error("You can't change your own account from the admin console.");
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  return { admin, user };
}

export async function setUserStatusAction(form: FormData): Promise<void> {
  const { admin, user } = await targetUser(form.get("userId"));
  const suspend = form.get("status") === "SUSPENDED";
  await prisma.user.update({ where: { id: user.id }, data: { status: suspend ? "SUSPENDED" : "ACTIVE" } });
  if (suspend) await prisma.session.deleteMany({ where: { userId: user.id } });
  await logActivity(admin.id, suspend ? "admin.user.suspend" : "admin.user.reactivate", user.email);
  void sendEmail(user.email, "accountStatus", emails.accountStatus({ appUrl: getServerConfig().APP_URL, name: user.name, suspended: suspend }));
  revalidatePath("/admin", "layout");
}

export async function setUserRoleAction(form: FormData): Promise<void> {
  const { admin, user } = await targetUser(form.get("userId"));
  const role = form.get("role") === "ADMIN" ? "ADMIN" : "USER";
  await prisma.user.update({ where: { id: user.id }, data: { role } });
  await logActivity(admin.id, role === "ADMIN" ? "admin.user.promote" : "admin.user.demote", user.email);
  revalidatePath("/admin", "layout");
}

export async function sendPasswordResetAction(form: FormData): Promise<void> {
  const { admin, user } = await targetUser(form.get("userId"));
  await startPasswordReset(user.id);
  await logActivity(admin.id, "admin.user.password_reset", user.email);
  revalidatePath("/admin", "layout");
}

/** Deletes the user's projects (and their files) first, then the account. */
export async function deleteUserAction(form: FormData): Promise<void> {
  const { admin, user } = await targetUser(form.get("userId"));
  if (form.get("confirm") !== user.email) throw new Error("Type the user's email to confirm.");
  const projects = await prisma.project.findMany({ where: { userId: user.id }, select: { id: true } });
  for (const p of projects) await deleteProject(p.id);
  await prisma.user.delete({ where: { id: user.id } });
  await logActivity(admin.id, "admin.user.delete", `${user.email} (${projects.length} projects)`);
  revalidatePath("/admin", "layout");
  redirect("/admin/users");
}

export async function adminRevokeShareAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  await revokeShareLink(z.uuid().parse(form.get("shareId")), admin);
  revalidatePath("/admin", "layout");
}

export async function saveSiteSettingsAction(_: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = siteSettingsSchema.safeParse({ ...Object.fromEntries(form), signupsOpen: form.get("signupsOpen") === "on" });
  if (!parsed.success)
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, error: "Some fields need attention.", values: Object.fromEntries([...form].map(([k, v]) => [k, String(v)])) };
  await saveSiteSettings(parsed.data);
  await logActivity(admin.id, "admin.site.update");
  revalidatePath("/", "layout");
  return { message: "Saved. The landing page is updated." };
}
