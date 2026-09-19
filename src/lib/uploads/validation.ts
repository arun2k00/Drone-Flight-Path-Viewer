import { AppError } from "@/lib/errors/app-error";
import type { ErrorCode } from "@/lib/errors/codes";
import { formatBytes } from "@/lib/format/bytes";
import type { UploadRole } from "@/types/api";

interface RoleRule {
  extensions: readonly string[];
  mimeByExt: Record<string, string>;
  unsupportedTypeCode: ErrorCode;
  tooLargeCode: ErrorCode;
}

const RULES: Record<UploadRole, RoleRule> = {
  VIDEO: {
    extensions: [".mp4", ".mov", ".m4v"],
    mimeByExt: { ".mp4": "video/mp4", ".mov": "video/quicktime", ".m4v": "video/x-m4v" },
    unsupportedTypeCode: "VIDEO_UNSUPPORTED_TYPE",
    tooLargeCode: "VIDEO_TOO_LARGE",
  },
  TELEMETRY: {
    extensions: [".srt"],
    mimeByExt: { ".srt": "application/x-subrip" },
    unsupportedTypeCode: "SRT_UNSUPPORTED_TYPE",
    tooLargeCode: "SRT_TOO_LARGE",
  },
  LOGO: {
    extensions: [".png", ".svg", ".webp"],
    mimeByExt: { ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp" },
    unsupportedTypeCode: "LOGO_INVALID",
    tooLargeCode: "LOGO_TOO_LARGE",
  },
};

export function extname(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

export interface UploadLimitsBytes {
  maxVideoBytes: number;
  maxSrtBytes: number;
  maxLogoBytes: number;
}

export interface ValidatedUploadInit {
  ext: string;
  mimeType: string;
}

/** Validates role/extension/size before an upload session is created (case-insensitive extension). */
export function validateUploadInit(
  input: { role: UploadRole; fileName: string; sizeBytes: number },
  limits: UploadLimitsBytes,
): ValidatedUploadInit {
  if (!(input.sizeBytes > 0)) throw new AppError("FILE_EMPTY");
  const rule = RULES[input.role];
  const ext = extname(input.fileName);
  if (!rule.extensions.includes(ext)) throw new AppError(rule.unsupportedTypeCode);
  const limitBytes =
    input.role === "VIDEO" ? limits.maxVideoBytes : input.role === "TELEMETRY" ? limits.maxSrtBytes : limits.maxLogoBytes;
  if (input.sizeBytes > limitBytes) {
    throw new AppError(rule.tooLargeCode, { details: { limit: formatBytes(limitBytes) } });
  }
  return { ext, mimeType: rule.mimeByExt[ext] };
}

const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;
const PATH_SEPARATORS = /[/\\]/g;

/** NFC-normalize, strip control chars and path separators, trim, cap at 255 chars, fallback "upload". */
export function sanitizeOriginalName(name: string): string {
  const normalized = name.normalize("NFC").replace(CONTROL_CHARS, "").replace(PATH_SEPARATORS, "_").trim();
  const truncated = normalized.slice(0, 255);
  return truncated || "upload";
}
