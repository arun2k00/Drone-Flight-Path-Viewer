import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { AppError } from "@/lib/errors/app-error";
import { parseUuidParam } from "@/lib/ids";
import { newToken, sha256 } from "./crypto";

const COOKIE = "ax_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
}

export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: sha256(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getServerConfig().APP_URL.startsWith("https://"),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  store.delete(COOKIE);
}

/** Once per request (React cache). Suspended users and expired sessions read as logged out. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  const { id, email, name, role } = session.user;
  return { id, email, name, role: role === "ADMIN" ? "ADMIN" : "USER" };
});

/** API routes and server actions. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHORIZED");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AppError("FORBIDDEN");
  return user;
}

/** Pages: bounce to the login page and come back afterwards. */
export async function requirePageUser(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await requirePageUser("/admin");
  if (user.role !== "ADMIN") notFound();
  return user;
}

const canAccess = (user: CurrentUser, ownerId: string | null | undefined) => user.role === "ADMIN" || (ownerId != null && ownerId === user.id);

/** Every /api/projects/[projectId] route and project page goes through here. Other users' projects read as "not found" (no existence leak). */
export async function requireProjectAccess(rawId: string): Promise<string> {
  const projectId = parseUuidParam(rawId, "PROJECT_NOT_FOUND");
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } });
  if (!project || !canAccess(user, project.userId)) throw new AppError("PROJECT_NOT_FOUND");
  return projectId;
}

export async function requireJobAccess(rawId: string): Promise<string> {
  const jobId = parseUuidParam(rawId, "JOB_NOT_FOUND");
  const user = await requireUser();
  const job = await prisma.renderJob.findUnique({ where: { id: jobId }, select: { project: { select: { userId: true } } } });
  if (!job || !canAccess(user, job.project.userId)) throw new AppError("JOB_NOT_FOUND");
  return jobId;
}

export async function requireUploadAccess(rawId: string): Promise<string> {
  const uploadId = parseUuidParam(rawId, "UPLOAD_NOT_FOUND");
  const user = await requireUser();
  const upload = await prisma.upload.findUnique({ where: { id: uploadId }, select: { project: { select: { userId: true } } } });
  if (!upload || !canAccess(user, upload.project.userId)) throw new AppError("UPLOAD_NOT_FOUND");
  return uploadId;
}
