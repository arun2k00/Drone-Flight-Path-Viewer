import { AppError } from "./errors/app-error";
import type { ErrorCode } from "./errors/codes";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Validates a route param as a UUID before any DB or filesystem access; throws notFoundCode otherwise (no information leak). */
export function parseUuidParam(value: string, notFoundCode: ErrorCode): string {
  if (!isUuid(value)) throw new AppError(notFoundCode);
  return value;
}
