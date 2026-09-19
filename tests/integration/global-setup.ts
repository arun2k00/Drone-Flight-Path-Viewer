import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

/**
 * Integration tests that need Prisma (export.int.test.ts) get a throwaway SQLite
 * DB, storage root and temp dir — real `./storage` and the real dev DB are never touched.
 */
export default async function setup(): Promise<() => Promise<void>> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dts-integration-"));
  const dbPath = path.join(root, "test.db");
  const storagePath = path.join(root, "storage");
  const tempPath = path.join(root, "temp");
  fs.mkdirSync(storagePath, { recursive: true });
  fs.mkdirSync(tempPath, { recursive: true });

  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.STORAGE_PATH = storagePath;
  process.env.TEMP_PATH = tempPath;

  await execFileP("npx", ["prisma", "migrate", "deploy"], { cwd: repoRoot, env: { ...process.env } });

  return async () => {
    fs.rmSync(root, { recursive: true, force: true });
  };
}
