import "server-only";
import { randomUUID } from "node:crypto";
import type { Upload } from "@/generated/prisma/client";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { AppError } from "@/lib/errors/app-error";
import { getProjectOrThrow, replaceStoredFile, setVideoMetadata } from "@/lib/projects/service.server";
import { getStorage } from "@/lib/storage/index.server";
import { keys } from "@/lib/storage/keys";
import { decodeSrtBytes, hasSrtTimingLine } from "@/lib/telemetry/srt-cues";
import { isIsoBmff } from "@/lib/uploads/magic";
import { isPngSignature, isWebpSignature, looksLikeSvg, rasterizeLogo } from "@/lib/uploads/logo.server";
import { extname, sanitizeOriginalName, validateUploadInit, type UploadLimitsBytes } from "@/lib/uploads/validation";
import { probeVideo } from "@/lib/video/probe.server";
import type { StoredFileDto, UploadRole, UploadSessionDto, UploadStatus } from "@/types/api";

// Survives dev HMR; a real per-uploadId lock is only meaningful within one process.
const g = globalThis as unknown as { __dtsUploadLocks?: Set<string> };
const activeLocks = (g.__dtsUploadLocks ??= new Set<string>());

function toUploadSessionDto(upload: Upload): UploadSessionDto {
  return {
    id: upload.id,
    role: upload.role as UploadRole,
    sizeBytes: upload.sizeBytes,
    receivedBytes: upload.receivedBytes,
    chunkSize: upload.chunkSize,
    status: upload.status as UploadStatus,
  };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function initUpload(
  projectId: string,
  input: { role: UploadRole; fileName: string; sizeBytes: number },
): Promise<UploadSessionDto> {
  await getProjectOrThrow(projectId);
  const config = getServerConfig();
  const limits: UploadLimitsBytes = {
    maxVideoBytes: config.MAX_VIDEO_SIZE_MB * 1024 * 1024,
    maxSrtBytes: config.MAX_SRT_SIZE_MB * 1024 * 1024,
    maxLogoBytes: config.MAX_LOGO_SIZE_MB * 1024 * 1024,
  };
  const { mimeType } = validateUploadInit(
    { role: input.role, fileName: input.fileName, sizeBytes: input.sizeBytes },
    limits,
  );

  const storage = getStorage();
  const stale = await prisma.upload.findMany({ where: { projectId, role: input.role, status: "PENDING" } });
  for (const s of stale) {
    await storage.delete(s.tempKey).catch(() => {});
  }
  if (stale.length > 0) {
    await prisma.upload.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { status: "ABORTED" } });
  }

  const uploadId = randomUUID();
  const tempKey = keys.uploadPart(uploadId);
  await storage.createEmpty(tempKey);

  const upload = await prisma.upload.create({
    data: {
      id: uploadId,
      projectId,
      role: input.role,
      originalName: sanitizeOriginalName(input.fileName),
      mimeType,
      sizeBytes: input.sizeBytes,
      chunkSize: config.UPLOAD_CHUNK_SIZE_MB * 1024 * 1024,
      tempKey,
    },
  });
  return toUploadSessionDto(upload);
}

export async function getUploadSession(uploadId: string): Promise<UploadSessionDto> {
  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) throw new AppError("UPLOAD_NOT_FOUND");
  return toUploadSessionDto(upload);
}

export async function putChunk(
  uploadId: string,
  offset: number,
  contentLength: number | null,
  body: ReadableStream<Uint8Array>,
): Promise<number> {
  if (activeLocks.has(uploadId)) throw new AppError("UPLOAD_BUSY");
  activeLocks.add(uploadId);
  try {
    const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
    if (!upload) throw new AppError("UPLOAD_NOT_FOUND");

    const storage = getStorage();
    const stat = await storage.stat(upload.tempKey);
    const actualReceived = stat?.sizeBytes ?? 0;
    if (offset !== actualReceived) {
      throw new AppError("UPLOAD_OFFSET_MISMATCH", { details: { receivedBytes: actualReceived } });
    }

    const maxBytes = Math.min(upload.chunkSize, upload.sizeBytes - offset);
    if (contentLength !== null && contentLength > maxBytes) {
      throw new AppError("UPLOAD_CHUNK_TOO_LARGE");
    }

    try {
      const written = await storage.writeAt(upload.tempKey, offset, body, maxBytes);
      const receivedBytes = offset + written;
      await prisma.upload.update({ where: { id: uploadId }, data: { receivedBytes } });
      return receivedBytes;
    } catch (err) {
      await storage.truncate(upload.tempKey, offset).catch(() => {});
      throw err instanceof AppError ? err : new AppError("UPLOAD_CHUNK_TOO_LARGE", { cause: err });
    }
  } finally {
    activeLocks.delete(uploadId);
  }
}

async function failComplete(uploadId: string, tempKey: string, error: AppError): Promise<never> {
  const storage = getStorage();
  await storage.delete(tempKey).catch(() => {});
  await prisma.upload.update({ where: { id: uploadId }, data: { status: "ABORTED" } }).catch(() => {});
  throw error;
}

export async function completeUpload(uploadId: string): Promise<StoredFileDto> {
  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) throw new AppError("UPLOAD_NOT_FOUND");

  const storage = getStorage();
  const stat = await storage.stat(upload.tempKey);
  if (!stat || stat.sizeBytes !== upload.sizeBytes) throw new AppError("UPLOAD_INCOMPLETE");

  if (upload.role === "LOGO") {
    const ext = extname(upload.originalName) as ".png" | ".svg" | ".webp";
    const fullBytes = await readAll(await storage.get(upload.tempKey));
    const magicOk = ext === ".png" ? isPngSignature(fullBytes) : ext === ".webp" ? isWebpSignature(fullBytes) : looksLikeSvg(fullBytes);
    if (!magicOk) return failComplete(uploadId, upload.tempKey, new AppError("LOGO_INVALID"));

    const png = await rasterizeLogo(fullBytes, ext).catch((err) =>
      failComplete(uploadId, upload.tempKey, err instanceof AppError ? err : new AppError("LOGO_INVALID")),
    );

    const sourceKey = keys.logoSource(upload.projectId, ext);
    await storage.save(sourceKey, fullBytes);
    await storage.delete(upload.tempKey).catch(() => {});

    const pngKey = keys.logoPng(upload.projectId);
    await storage.save(pngKey, png);

    const storedFileDto = await replaceStoredFile(upload.projectId, {
      role: "LOGO",
      storageKey: pngKey,
      originalName: upload.originalName,
      mimeType: "image/png",
      sizeBytes: png.byteLength,
    });
    await prisma.upload.update({ where: { id: uploadId }, data: { status: "COMPLETE" } });
    return storedFileDto;
  }

  const headerEnd = Math.min(65_535, upload.sizeBytes - 1);
  const header = await readAll(await storage.get(upload.tempKey, { start: 0, end: headerEnd }));

  if (upload.role === "TELEMETRY") {
    const { text, replacementRatio } = decodeSrtBytes(header);
    if (replacementRatio > 0.01 || !hasSrtTimingLine(text)) {
      return failComplete(uploadId, upload.tempKey, new AppError("SRT_INVALID"));
    }

    const targetKey = keys.sourceTelemetry(upload.projectId);
    await storage.move(upload.tempKey, targetKey);
    const storedFileDto = await replaceStoredFile(upload.projectId, {
      role: "TELEMETRY",
      storageKey: targetKey,
      originalName: upload.originalName,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
    });
    await prisma.upload.update({ where: { id: uploadId }, data: { status: "COMPLETE" } });
    return storedFileDto;
  }

  if (!isIsoBmff(header)) {
    return failComplete(uploadId, upload.tempKey, new AppError("VIDEO_INVALID_CONTAINER"));
  }

  const localPath = storage.resolveLocalPath(upload.tempKey);
  const metadata = await probeVideo(localPath, upload.sizeBytes).catch((err) =>
    failComplete(uploadId, upload.tempKey, err instanceof AppError ? err : new AppError("VIDEO_UNREADABLE")),
  );

  const ext = extname(upload.originalName) as ".mp4" | ".mov" | ".m4v";
  const targetKey = keys.sourceVideo(upload.projectId, ext);
  await storage.move(upload.tempKey, targetKey);

  const storedFileDto = await replaceStoredFile(upload.projectId, {
    role: "VIDEO",
    storageKey: targetKey,
    originalName: upload.originalName,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
  });
  await setVideoMetadata(upload.projectId, metadata);
  await prisma.upload.update({ where: { id: uploadId }, data: { status: "COMPLETE" } });

  return storedFileDto;
}

export async function deleteUpload(uploadId: string): Promise<void> {
  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) return;
  await getStorage()
    .delete(upload.tempKey)
    .catch(() => {});
  await prisma.upload.delete({ where: { id: uploadId } }).catch(() => {});
}
