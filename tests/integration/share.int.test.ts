import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CurrentUser } from "@/lib/auth/session.server";
import { prisma } from "@/lib/db.server";
import { AppError } from "@/lib/errors/app-error";
import { createShareLink, listShareLinks, recordShareView, resolveShare, revokeShareLink } from "@/lib/share/service.server";

describe("client share links", () => {
  let owner: CurrentUser;
  let other: CurrentUser;
  let projectId: string;

  beforeAll(async () => {
    const mk = (email: string) => prisma.user.create({ data: { email, name: email.split("@")[0], passwordHash: "x" } });
    const [a, b] = await Promise.all([mk("owner@share.test"), mk("other@share.test")]);
    owner = { id: a.id, email: a.email, name: a.name, role: "USER" };
    other = { id: b.id, email: b.email, name: b.name, role: "USER" };
    const project = await prisma.project.create({ data: { name: "Share test", status: "READY", userId: owner.id, telemetrySettings: {}, overlayConfig: {} } });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: "@share.test" } } });
  });

  const notFound = async (p: Promise<unknown>) => {
    const err = await p.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("SHARE_NOT_FOUND");
  };

  it("resolves an active link and counts views; only the first view emails the owner", async () => {
    const link = await createShareLink(projectId, owner, { expiresInDays: 7, recipientName: null, recipientEmail: null, message: null, allowDownload: true });
    const token = link.url.split("/s/")[1];
    const resolved = await resolveShare(token);
    expect(resolved.project.id).toBe(projectId);

    const before = await prisma.emailLog.count({ where: { template: "shareViewed" } });
    await recordShareView(resolved);
    await recordShareView(resolved);
    await new Promise((r) => setTimeout(r, 200)); // the owner email is fire-and-forget
    expect(await prisma.emailLog.count({ where: { template: "shareViewed" } })).toBe(before + 1);
    expect((await listShareLinks(projectId)).find((l) => l.id === link.id)?.viewCount).toBe(2);
  });

  it("revoked, expired, malformed and suspended-owner links all read as not found", async () => {
    const mk = () => createShareLink(projectId, owner, { expiresInDays: 1, recipientName: null, recipientEmail: null, message: null, allowDownload: false });
    const tokenOf = (url: string) => url.split("/s/")[1];

    const revoked = await mk();
    await notFound(revokeShareLink(revoked.id, other)); // not the owner
    await revokeShareLink(revoked.id, owner);
    await notFound(resolveShare(tokenOf(revoked.url)));

    const expired = await mk();
    await prisma.shareLink.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await notFound(resolveShare(tokenOf(expired.url)));
    expect((await listShareLinks(projectId)).find((l) => l.id === expired.id)?.status).toBe("EXPIRED");

    await notFound(resolveShare("../../etc/passwd"));

    const active = await mk();
    await prisma.user.update({ where: { id: owner.id }, data: { status: "SUSPENDED" } });
    await notFound(resolveShare(tokenOf(active.url)));
    await prisma.user.update({ where: { id: owner.id }, data: { status: "ACTIVE" } });
    await expect(resolveShare(tokenOf(active.url))).resolves.toBeTruthy();
  });

  it("emails the client when a recipient is given", async () => {
    const link = await createShareLink(projectId, owner, { expiresInDays: 3, recipientName: "Client", recipientEmail: "client@share.test", message: "See 03:20", allowDownload: true });
    expect(link.emailed).toBe(true);
    const log = await prisma.emailLog.findFirst({ where: { to: "client@share.test" } });
    expect(log?.template).toBe("shareInvite");
  });
});
