import "server-only";
import { open, stat, type FileHandle } from "node:fs/promises";
import { parseRangeHeader } from "./range";
import { contentDisposition } from "@/lib/format/content-disposition";

const CHUNK = 256 * 1024;

/** Pull-based Range stream (verified). */
export function fileRangeStream(filePath: string, start: number, end: number): ReadableStream<Uint8Array> {
  let handle: FileHandle | null = null;
  let position = start;
  let closed = false;
  return new ReadableStream<Uint8Array>({
    async start() {
      handle = await open(filePath, "r");
    },
    async pull(controller) {
      if (closed || !handle) return;
      const remaining = end - position + 1;
      if (remaining <= 0) {
        closed = true;
        await handle.close();
        handle = null;
        controller.close();
        return;
      }
      const size = Math.min(CHUNK, remaining);
      const buf = new Uint8Array(size);
      const { bytesRead } = await handle.read(buf, 0, size, position);
      if (closed) return;
      if (bytesRead === 0) {
        closed = true;
        await handle.close();
        handle = null;
        controller.close();
        return;
      }
      position += bytesRead;
      controller.enqueue(bytesRead === size ? buf : buf.subarray(0, bytesRead));
    },
    async cancel() {
      closed = true;
      const h = handle;
      handle = null;
      await h?.close().catch(() => {});
    },
  });
}

export async function fileResponse(
  req: Request,
  filePath: string,
  opts: { contentType: string; downloadName?: string },
): Promise<Response> {
  const { size } = await stat(filePath);
  const headers = new Headers({ "Accept-Ranges": "bytes", "Content-Type": opts.contentType, "Cache-Control": "no-store" });
  if (opts.downloadName) headers.set("Content-Disposition", contentDisposition(opts.downloadName));
  const r = parseRangeHeader(req.headers.get("range"), size);
  if (r.kind === "unsatisfiable") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  const start = r.kind === "range" ? r.start : 0;
  const end = r.kind === "range" ? r.end : size - 1;
  headers.set("Content-Length", String(end - start + 1));
  if (r.kind === "range") headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  return new Response(size === 0 ? null : fileRangeStream(filePath, start, end), {
    status: r.kind === "range" ? 206 : 200,
    headers,
  });
}
