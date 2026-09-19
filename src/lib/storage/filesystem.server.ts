import "server-only";
import { createWriteStream } from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { AppError } from "@/lib/errors/app-error";
import { fileRangeStream } from "@/lib/video/file-response.server";
import { isValidKey } from "./keys";
import type { StorageProvider, StorageStat } from "./provider";

function limitStream(maxBytes: number): { stream: TransformStream<Uint8Array, Uint8Array>; getWritten: () => number } {
  let written = 0;
  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      written += chunk.byteLength;
      if (written > maxBytes) {
        controller.error(new Error("Upload chunk exceeds the allowed size"));
        return;
      }
      controller.enqueue(chunk);
    },
  });
  return { stream, getWritten: () => written };
}

export class LocalFilesystemStorage implements StorageProvider {
  readonly kind = "local" as const;
  private readonly root: string;

  constructor(storagePath: string) {
    this.root = path.resolve(storagePath);
  }

  resolveLocalPath(key: string, opts: { allowPrefix?: boolean } = {}): string {
    if (!opts.allowPrefix && !isValidKey(key)) {
      throw new AppError("INTERNAL_ERROR", { logDetail: { reason: "invalid storage key", key } });
    }
    const resolved = path.resolve(this.root, key);
    if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) {
      throw new AppError("INTERNAL_ERROR", { logDetail: { reason: "storage key escapes root", key } });
    }
    return resolved;
  }

  async save(key: string, data: Uint8Array | string | ReadableStream<Uint8Array>): Promise<StorageStat> {
    const filePath = this.resolveLocalPath(key);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    if (data instanceof ReadableStream) {
      const nodeReadable = Readable.fromWeb(data as unknown as NodeWebReadableStream<Uint8Array>);
      await pipeline(nodeReadable, createWriteStream(filePath));
    } else {
      await fsp.writeFile(filePath, data);
    }
    return this.statOrThrow(filePath);
  }

  async get(key: string, range?: { start: number; end: number }): Promise<ReadableStream<Uint8Array>> {
    const filePath = this.resolveLocalPath(key);
    const { size } = await fsp.stat(filePath);
    const start = range?.start ?? 0;
    const end = range?.end ?? size - 1;
    return fileRangeStream(filePath, start, end);
  }

  async readBuffer(key: string): Promise<Uint8Array> {
    const filePath = this.resolveLocalPath(key);
    return fsp.readFile(filePath);
  }

  async stat(key: string): Promise<StorageStat | null> {
    try {
      const filePath = this.resolveLocalPath(key);
      return await this.statOrThrow(filePath);
    } catch (err) {
      if (isEnoent(err)) return null;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    return (await this.stat(key)) !== null;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveLocalPath(key);
    await fsp.rm(filePath, { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    const dirPath = this.resolveLocalPath(prefix, { allowPrefix: true });
    await fsp.rm(dirPath, { recursive: true, force: true });
  }

  async move(fromKey: string, toKey: string): Promise<void> {
    const fromPath = this.resolveLocalPath(fromKey);
    const toPath = this.resolveLocalPath(toKey);
    await fsp.mkdir(path.dirname(toPath), { recursive: true });
    try {
      await fsp.rename(fromPath, toPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EXDEV") {
        await fsp.copyFile(fromPath, toPath);
        await fsp.rm(fromPath, { force: true });
      } else {
        throw err;
      }
    }
  }

  async createEmpty(key: string): Promise<void> {
    const filePath = this.resolveLocalPath(key);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const handle = await fsp.open(filePath, "w");
    await handle.close();
  }

  async writeAt(key: string, offset: number, body: ReadableStream<Uint8Array>, maxBytes: number): Promise<number> {
    const filePath = this.resolveLocalPath(key);
    const { stream: limiter, getWritten } = limitStream(maxBytes);
    const limited = body.pipeThrough(limiter);
    const nodeReadable = Readable.fromWeb(limited as unknown as NodeWebReadableStream<Uint8Array>);
    const writeStream = createWriteStream(filePath, { flags: "r+", start: offset });
    await pipeline(nodeReadable, writeStream);
    return getWritten();
  }

  async truncate(key: string, sizeBytes: number): Promise<void> {
    const filePath = this.resolveLocalPath(key);
    await fsp.truncate(filePath, sizeBytes);
  }

  private async statOrThrow(filePath: string): Promise<StorageStat> {
    const s = await fsp.stat(filePath);
    return { sizeBytes: s.size, modifiedAt: s.mtime };
  }
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT";
}

/** Free bytes on the filesystem holding `dirPath` (used by diagnostics). */
export async function statfsFree(dirPath: string): Promise<number> {
  const stats = await fsp.statfs(dirPath);
  return stats.bavail * stats.bsize;
}

export function osTmpDir(): string {
  return os.tmpdir();
}
