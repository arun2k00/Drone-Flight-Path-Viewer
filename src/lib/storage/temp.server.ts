import "server-only";
import fsp from "node:fs/promises";
import path from "node:path";
import { getServerConfig } from "@/lib/config/env.server";

/** Export scratch space is {TEMP_PATH}/{projectId}/{jobId}/. */
export function exportTempDir(projectId: string, jobId: string): string {
  return path.join(getServerConfig().TEMP_PATH, projectId, jobId);
}

async function safeReaddir(dirPath: string): Promise<string[]> {
  try {
    return await fsp.readdir(dirPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/** Deletes top-level entries under TEMP_PATH older than maxAgeMs (startup housekeeping). */
export async function cleanupOldTempDirs(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
  const root = getServerConfig().TEMP_PATH;
  const entries = await safeReaddir(root);
  const now = Date.now();
  let removed = 0;
  for (const entry of entries) {
    const entryPath = path.join(root, entry);
    try {
      const stat = await fsp.stat(entryPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        await fsp.rm(entryPath, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      // Best-effort: a directory removed concurrently is not an error.
    }
  }
  return removed;
}
