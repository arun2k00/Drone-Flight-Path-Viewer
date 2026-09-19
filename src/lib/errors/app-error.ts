import { ERROR_CATALOG, formatCatalogMessage, type ErrorCode } from "./codes";

export interface AppErrorOptions {
  /** Safe, documented fields sent to the client and used to interpolate the message template. */
  details?: Record<string, unknown>;
  cause?: unknown;
  /** Extra context logged on the server only, never sent to the client. */
  logDetail?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly logDetail?: Record<string, unknown>;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const entry = ERROR_CATALOG[code];
    super(formatCatalogMessage(code, options.details));
    this.name = "AppError";
    this.code = code;
    this.status = entry.status;
    this.details = options.details;
    this.logDetail = options.logDetail;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}
