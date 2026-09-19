import type { StoredFileDto, UploadRole, UploadSessionDto } from "@/types/api";

export class UploadError extends Error {
  readonly code: string;
  readonly status: number | undefined;
  readonly details: Record<string, unknown> | null;

  constructor(error: { code?: string; message?: string; details?: Record<string, unknown> | null } | null, status?: number) {
    super(error?.message ?? "Upload failed.");
    this.name = "UploadError";
    this.code = error?.code ?? "INTERNAL_ERROR";
    this.status = status;
    this.details = error?.details ?? null;
  }
}

export interface UploadProgress {
  /** Bytes of this file confirmed written on the server so far. */
  doneBytes: number;
  totalBytes: number;
  bytesPerSec: number;
  etaSec: number | null;
}

export interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function initUpload(projectId: string, file: File, role: UploadRole): Promise<UploadSessionDto> {
  const res = await fetch(`/api/projects/${projectId}/uploads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role, fileName: file.name, sizeBytes: file.size, mimeType: file.type || "application/octet-stream" }),
  });
  const body = (await readJson(res)) as { upload?: UploadSessionDto; error?: UploadError["details"] & { code?: string; message?: string } } | null;
  if (!res.ok) throw new UploadError(body?.error ?? null, res.status);
  if (!body?.upload) throw new UploadError(null, res.status);
  return body.upload;
}

async function getUploadSession(uploadId: string): Promise<UploadSessionDto> {
  const res = await fetch(`/api/uploads/${uploadId}`);
  const body = (await readJson(res)) as { upload?: UploadSessionDto; error?: { code?: string; message?: string } } | null;
  if (!res.ok || !body?.upload) throw new UploadError(body?.error ?? null, res.status);
  return body.upload;
}

async function abortUpload(uploadId: string): Promise<void> {
  await fetch(`/api/uploads/${uploadId}`, { method: "DELETE" }).catch(() => {});
}

async function completeUpload(uploadId: string): Promise<StoredFileDto> {
  const res = await fetch(`/api/uploads/${uploadId}/complete`, { method: "POST" });
  const body = (await readJson(res)) as { file?: StoredFileDto; error?: { code?: string; message?: string } } | null;
  if (!res.ok || !body?.file) throw new UploadError(body?.error ?? null, res.status);
  return body.file;
}

/** XHR (not fetch) because only XHR exposes upload progress events. */
function xhrPutChunk(
  uploadId: string,
  offset: number,
  blob: Blob,
  onLoaded: (loaded: number, elapsedSec: number) => void,
  signal: AbortSignal | undefined,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const t0 = performance.now();
    xhr.open("PUT", `/api/uploads/${uploadId}?offset=${offset}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort);
    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded(e.loaded, (performance.now() - t0) / 1000);
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new UploadError({ code: "NETWORK_ERROR", message: "Network error." }, 0));
    };
    xhr.onload = () => {
      cleanup();
      let body: { receivedBytes?: number; error?: { code?: string; message?: string; details?: Record<string, unknown> | null } } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // handled below via status check
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.receivedBytes !== undefined) {
        resolve(body.receivedBytes);
      } else {
        reject(new UploadError(body?.error ?? null, xhr.status));
      }
    };
    xhr.send(blob);
  });
}

const MAX_ATTEMPTS = 5;

async function putChunkWithRetry(
  session: UploadSessionDto,
  file: File,
  startOffset: number,
  options: UploadOptions,
): Promise<number> {
  let offset = startOffset;
  let attempt = 0;
  for (;;) {
    const chunkEnd = Math.min(offset + session.chunkSize, session.sizeBytes);
    const blob = file.slice(offset, chunkEnd);
    const chunkStartOffset = offset;
    let emaBytesPerSec = 0;
    try {
      return await xhrPutChunk(
        session.id,
        offset,
        blob,
        (loaded, elapsedSec) => {
          const instBps = elapsedSec > 0 ? loaded / elapsedSec : 0;
          emaBytesPerSec = emaBytesPerSec === 0 ? instBps : emaBytesPerSec * 0.7 + instBps * 0.3;
          const doneBytes = chunkStartOffset + loaded;
          const remaining = session.sizeBytes - doneBytes;
          options.onProgress?.({
            doneBytes,
            totalBytes: session.sizeBytes,
            bytesPerSec: emaBytesPerSec,
            etaSec: emaBytesPerSec > 0 ? remaining / emaBytesPerSec : null,
          });
        },
        options.signal,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (err instanceof UploadError && err.code === "UPLOAD_OFFSET_MISMATCH") {
        offset = (err.details?.receivedBytes as number | undefined) ?? offset;
        continue; // resume immediately at the server's actual offset — not a failed attempt
      }
      const retryable = !(err instanceof UploadError) || err.status === 0 || err.status === undefined || err.status >= 500;
      attempt += 1;
      if (!retryable || attempt > MAX_ATTEMPTS) throw err;
      await sleep(1000 * 2 ** attempt);
      try {
        offset = (await getUploadSession(session.id)).receivedBytes;
      } catch {
        // Keep the last known offset; the next PUT fails cleanly (UPLOAD_OFFSET_MISMATCH) if it's wrong.
      }
    }
  }
}

/**
 * Uploads one file for a project role via chunked, resumable PUTs, then completes it.
 * The browser never reads the file into memory — Blob.slice is lazy.
 */
export async function uploadFile(projectId: string, role: UploadRole, file: File, options: UploadOptions = {}): Promise<StoredFileDto> {
  const session = await initUpload(projectId, file, role);
  let offset = session.receivedBytes;

  try {
    while (offset < session.sizeBytes) {
      if (options.signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");
      offset = await putChunkWithRetry(session, file, offset, options);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      await abortUpload(session.id);
    }
    throw err;
  }

  return completeUpload(session.id);
}
