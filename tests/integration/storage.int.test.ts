import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalFilesystemStorage } from "@/lib/storage/filesystem.server";

function bufferToStream(buf: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(buf);
      controller.close();
    },
  });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

describe("LocalFilesystemStorage", () => {
  let root: string;
  let storage: LocalFilesystemStorage;

  beforeAll(async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), "dts-storage-test-"));
    storage = new LocalFilesystemStorage(root);
  });

  afterAll(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  it("writeAt appends chunks at the given offset and readBuffer returns the concatenation", async () => {
    const key = "projects/p1/source/video.mp4";
    await storage.createEmpty(key);
    const chunkA = Buffer.from("hello ");
    const chunkB = Buffer.from("world!");
    const writtenA = await storage.writeAt(key, 0, bufferToStream(chunkA), 1024);
    const writtenB = await storage.writeAt(key, chunkA.byteLength, bufferToStream(chunkB), 1024);

    expect(writtenA).toBe(chunkA.byteLength);
    expect(writtenB).toBe(chunkB.byteLength);
    const full = await storage.readBuffer(key);
    expect(Buffer.from(full).toString("utf8")).toBe("hello world!");
  });

  it("get() returns a byte-exact range", async () => {
    const key = "projects/p1/derived/range-test.bin";
    await storage.save(key, Buffer.from("0123456789"));
    const stream = await storage.get(key, { start: 2, end: 5 });
    const buf = await readAll(stream);
    expect(buf.toString("utf8")).toBe("2345");
  });

  it("truncate() cuts a file back to the given size, e.g. after a failed chunk", async () => {
    const key = "projects/p1/derived/truncate-test.bin";
    await storage.save(key, Buffer.from("0123456789"));
    await storage.truncate(key, 4);
    const buf = await storage.readBuffer(key);
    expect(Buffer.from(buf).toString("utf8")).toBe("0123");
    const stat = await storage.stat(key);
    expect(stat?.sizeBytes).toBe(4);
  });

  it("writeAt rejects a chunk larger than maxBytes and writes nothing past the limit", async () => {
    const key = "projects/p1/derived/limit-test.bin";
    await storage.createEmpty(key);
    await expect(storage.writeAt(key, 0, bufferToStream(Buffer.from("0123456789")), 4)).rejects.toThrow();
  });

  it("resolveLocalPath rejects keys that escape the storage root", () => {
    expect(() => storage.resolveLocalPath("../../etc/passwd")).toThrow();
  });
});
