import "server-only";
import fsp from "node:fs/promises";
import path from "node:path";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { formatCatalogMessage } from "@/lib/errors/codes";
import { logger } from "@/lib/errors/logger.server";
import { getStorage } from "@/lib/storage/index.server";
import { keys } from "@/lib/storage/keys";
import { cleanupOldTempDirs } from "@/lib/storage/temp.server";

const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

async function ensureDirectories(config: ReturnType<typeof getServerConfig>): Promise<void> {
  await Promise.all(
    [config.STORAGE_PATH, path.join(config.STORAGE_PATH, "uploads"), path.join(config.STORAGE_PATH, "projects"), config.TEMP_PATH].map(
      (dir) => fsp.mkdir(dir, { recursive: true }),
    ),
  );
}

async function recoverInterruptedJobs(): Promise<void> {
  try {
    const result = await prisma.renderJob.updateMany({
      where: { status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "FAILED", errorCode: "EXPORT_INTERRUPTED", errorMessage: formatCatalogMessage("EXPORT_INTERRUPTED"), finishedAt: new Date() },
    });
    if (result.count > 0) logger.info("startup", `Recovered ${result.count} interrupted job(s)`);
  } catch (err) {
    logger.warn("startup", "Database not migrated — run `npx prisma migrate dev`", {
      err: { message: err instanceof Error ? err.message : String(err) },
    });
  }
}

async function abortStaleUploads(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STALE_UPLOAD_MS);
    const stale = await prisma.upload.findMany({ where: { status: "PENDING", createdAt: { lt: cutoff } } });
    if (stale.length === 0) return;
    const storage = getStorage();
    for (const upload of stale) {
      await storage.delete(keys.uploadPart(upload.id)).catch(() => {});
    }
    await prisma.upload.updateMany({ where: { id: { in: stale.map((u) => u.id) } }, data: { status: "ABORTED" } });
    logger.info("startup", `Aborted ${stale.length} stale upload(s)`);
  } catch (err) {
    logger.warn("startup", "Failed to abort stale uploads", { err: { message: err instanceof Error ? err.message : String(err) } });
  }
}

async function sweepTempDirs(): Promise<void> {
  try {
    const removed = await cleanupOldTempDirs();
    if (removed > 0) logger.info("startup", `Deleted ${removed} stale temp dir(s)`);
  } catch (err) {
    logger.warn("startup", "Failed to sweep temp directories", { err: { message: err instanceof Error ? err.message : String(err) } });
  }
}

export async function runStartupTasks(): Promise<void> {
  // Config validation is fatal — everything else is best-effort and logs a warning instead of crashing.
  const config = getServerConfig();
  logger.info("startup", "Aeroxpress starting", { storagePath: config.STORAGE_PATH, tempPath: config.TEMP_PATH });

  await ensureDirectories(config).catch((err) =>
    logger.warn("startup", "Failed to create storage directories", { err: { message: err instanceof Error ? err.message : String(err) } }),
  );
  await recoverInterruptedJobs();
  await abortStaleUploads();
  await sweepTempDirs();
  logger.info("startup", "Startup tasks complete");
}
