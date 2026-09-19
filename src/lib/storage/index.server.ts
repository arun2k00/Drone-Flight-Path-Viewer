import "server-only";
import { getServerConfig } from "@/lib/config/env.server";
import { LocalFilesystemStorage } from "./filesystem.server";
import type { StorageProvider } from "./provider";

const g = globalThis as unknown as { __dtsStorage?: StorageProvider };

export function getStorage(): StorageProvider {
  if (!g.__dtsStorage) {
    g.__dtsStorage = new LocalFilesystemStorage(getServerConfig().STORAGE_PATH);
  }
  return g.__dtsStorage;
}
