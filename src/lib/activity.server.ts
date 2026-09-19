import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db.server";
import { logger } from "@/lib/errors/logger.server";

async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
  } catch {
    return null; // outside a request (e.g. the export runner)
  }
}

/** Audit trail shown in the admin console. Never throws: a failed log line must not fail the user's action. */
export async function logActivity(userId: string | null, action: string, detail?: string): Promise<void> {
  try {
    await prisma.activity.create({ data: { userId, action, detail: detail?.slice(0, 500) ?? null, ip: await clientIp() } });
  } catch (err) {
    logger.warn("activity", "Failed to record activity", { action, err: { message: err instanceof Error ? err.message : String(err) } });
  }
}
