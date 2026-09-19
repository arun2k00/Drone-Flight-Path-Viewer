import "server-only";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { sendEmail } from "@/lib/email/send.server";
import { emails } from "@/lib/email/templates";
import { newToken, sha256 } from "./crypto";

const RESET_TTL_MIN = 60;

/** Emails a one-time, 60-minute reset link. Used by "forgot password" and by the admin console. */
export async function startPasswordReset(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const token = newToken();
  await prisma.passwordReset.create({ data: { id: sha256(token), userId, expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000) } });
  const { APP_URL } = getServerConfig();
  await sendEmail(user.email, "passwordReset", emails.passwordReset({ appUrl: APP_URL, name: user.name, url: `${APP_URL}/reset-password?token=${token}`, minutes: RESET_TTL_MIN }));
}
