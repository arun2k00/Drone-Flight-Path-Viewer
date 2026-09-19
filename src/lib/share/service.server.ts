import "server-only";
import { z } from "zod";
import { logActivity } from "@/lib/activity.server";
import { newToken } from "@/lib/auth/crypto";
import type { CurrentUser } from "@/lib/auth/session.server";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { sendEmail } from "@/lib/email/send.server";
import { emails } from "@/lib/email/templates";
import { AppError } from "@/lib/errors/app-error";

export const EXPIRY_DAYS = [1, 3, 7, 14, 30] as const;

export const createShareSchema = z.object({
  expiresInDays: z.number().int().refine((d) => (EXPIRY_DAYS as readonly number[]).includes(d), "Pick one of the offered expiry periods."),
  recipientName: z.string().trim().max(80).optional().transform((v) => v || null),
  recipientEmail: z.union([z.literal(""), z.email()]).optional().transform((v) => v?.toLowerCase() || null),
  message: z.string().trim().max(1000).optional().transform((v) => v || null),
  allowDownload: z.boolean(),
});

export interface ShareLinkDto {
  id: string;
  url: string;
  recipientName: string | null;
  recipientEmail: string | null;
  allowDownload: boolean;
  expiresAt: string;
  revokedAt: string | null;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
}

type ShareRow = Awaited<ReturnType<typeof prisma.shareLink.findFirstOrThrow>>;

export const shareUrl = (token: string) => `${getServerConfig().APP_URL}/s/${token}`;

function toDto(link: ShareRow): ShareLinkDto {
  const status = link.revokedAt ? "REVOKED" : link.expiresAt < new Date() ? "EXPIRED" : "ACTIVE";
  return {
    id: link.id,
    url: shareUrl(link.token),
    recipientName: link.recipientName,
    recipientEmail: link.recipientEmail,
    allowDownload: link.allowDownload,
    expiresAt: link.expiresAt.toISOString(),
    revokedAt: link.revokedAt?.toISOString() ?? null,
    status,
    viewCount: link.viewCount,
    lastViewedAt: link.lastViewedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
  };
}

export async function listShareLinks(projectId: string): Promise<ShareLinkDto[]> {
  const links = await prisma.shareLink.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  return links.map(toDto);
}

/** Creates a temporary public link and, when a recipient email is given, emails it to the client. */
export async function createShareLink(projectId: string, user: CurrentUser, input: z.infer<typeof createShareSchema>): Promise<ShareLinkDto & { emailed: boolean }> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  if (project.status !== "READY") throw new AppError("ANALYSIS_REQUIRED");

  const link = await prisma.shareLink.create({
    data: {
      token: newToken(),
      projectId,
      createdById: user.id,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      message: input.message,
      allowDownload: input.allowDownload,
      expiresAt: new Date(Date.now() + input.expiresInDays * 864e5),
    },
  });
  await logActivity(user.id, "share.create", `${project.name} → ${input.recipientEmail ?? "link only"} (${input.expiresInDays}d)`);

  let emailed = false;
  if (link.recipientEmail) {
    const status = await sendEmail(
      link.recipientEmail,
      "shareInvite",
      emails.shareInvite({
        appUrl: getServerConfig().APP_URL,
        senderName: user.name,
        recipientName: link.recipientName,
        projectName: project.name,
        message: link.message,
        url: shareUrl(link.token),
        expiresAt: link.expiresAt,
        allowDownload: link.allowDownload,
      }),
    );
    emailed = status !== "FAILED";
  }
  return { ...toDto(link), emailed };
}

/** Owner or admin. Revoking is permanent; create a new link to share again. */
export async function revokeShareLink(shareId: string, user: CurrentUser): Promise<void> {
  const link = await prisma.shareLink.findUnique({ where: { id: shareId }, include: { project: { select: { userId: true } } } });
  if (!link || (user.role !== "ADMIN" && link.project.userId !== user.id)) throw new AppError("SHARE_NOT_FOUND");
  if (!link.revokedAt) await prisma.shareLink.update({ where: { id: shareId }, data: { revokedAt: new Date() } });
  await logActivity(user.id, "share.revoke", shareId);
}

/**
 * Public lookup by token. Expired, revoked, or owned by a suspended user all read as "not found"
 * so a link's state isn't disclosed.
 */
export async function resolveShare(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new AppError("SHARE_NOT_FOUND");
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: { project: { include: { files: true, jobs: { where: { status: "COMPLETE" }, orderBy: { finishedAt: "desc" }, take: 1 }, user: true } }, createdBy: true },
  });
  if (!link || link.revokedAt || link.expiresAt < new Date() || link.createdBy.status !== "ACTIVE") throw new AppError("SHARE_NOT_FOUND");
  return link;
}

/** Counts a page view; the first view notifies the owner by email. */
export async function recordShareView(link: Awaited<ReturnType<typeof resolveShare>>): Promise<void> {
  const updated = await prisma.shareLink.update({ where: { id: link.id }, data: { viewCount: { increment: 1 }, lastViewedAt: new Date() } });
  if (updated.viewCount !== 1) return;
  await logActivity(link.createdById, "share.first_view", `${link.project.name} (${link.recipientEmail ?? "link"})`);
  void sendEmail(
    link.createdBy.email,
    "shareViewed",
    emails.shareViewed({ appUrl: getServerConfig().APP_URL, name: link.createdBy.name, projectName: link.project.name, recipient: link.recipientName ?? link.recipientEmail, projectId: link.projectId }),
  );
}
