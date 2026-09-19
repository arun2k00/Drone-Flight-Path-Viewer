import "server-only";
import fsp from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { logger } from "@/lib/errors/logger.server";
import type { EmailTemplate, RenderedEmail } from "./templates";

let transport: Transporter | null = null;

/**
 * Sends one email and records it in EmailLog. Without SMTP configured the email is written to
 * <STORAGE_PATH>/outbox/*.html so development and self-hosting work out of the box.
 * Never throws: email is a side effect and must not fail the action that triggered it.
 */
export async function sendEmail(to: string, template: EmailTemplate, email: RenderedEmail): Promise<"SENT" | "SAVED" | "FAILED"> {
  const config = getServerConfig();
  let status: "SENT" | "SAVED" | "FAILED";
  let error: string | null = null;
  try {
    if (config.SMTP) {
      transport ??= nodemailer.createTransport({
        host: config.SMTP.host,
        port: config.SMTP.port,
        secure: config.SMTP.secure,
        auth: config.SMTP.user ? { user: config.SMTP.user, pass: config.SMTP.pass ?? "" } : undefined,
      });
      await transport.sendMail({ from: config.MAIL_FROM, to, subject: email.subject, html: email.html, text: email.text });
      status = "SENT";
    } else {
      const dir = path.join(config.STORAGE_PATH, "outbox");
      await fsp.mkdir(dir, { recursive: true });
      const safeTo = to.replace(/[^a-z0-9@._-]/gi, "_");
      await fsp.writeFile(path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}_${template}_${safeTo}.html`), email.html);
      status = "SAVED";
    }
  } catch (err) {
    status = "FAILED";
    error = err instanceof Error ? err.message : String(err);
    logger.warn("email", "Email delivery failed", { template, err: { message: error } });
  }
  await prisma.emailLog.create({ data: { to, template, subject: email.subject, status, error } }).catch(() => {});
  return status;
}

/** Every active admin; used for "new signup" notices. */
export async function adminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { email: true } });
  return admins.map((a) => a.email);
}
