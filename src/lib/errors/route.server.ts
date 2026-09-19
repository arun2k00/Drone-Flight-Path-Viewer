import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { AppError } from "./app-error";
import { ERROR_CATALOG } from "./codes";
import { logger } from "./logger.server";

/** Parses a JSON request body against a zod schema; throws VALIDATION_FAILED with path+message issues only. */
export function parseBody<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new AppError("VALIDATION_FAILED", {
      details: { issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) },
    });
  }
  return parsed.data;
}

/** Runs a route handler, turning AppError into the envelope and logging everything else as INTERNAL_ERROR. Never serializes a stack trace to the client. */
export async function runRoute(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof AppError) {
      logger.warn("route", err.message, { code: err.code, ...err.logDetail });
      return Response.json(
        { error: { code: err.code, message: err.message, details: err.details ?? null } },
        { status: err.status || 500 },
      );
    }
    const requestId = randomUUID();
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("route", error.message, {
      requestId,
      err: { name: error.name, message: error.message, stack: error.stack },
    });
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: ERROR_CATALOG.INTERNAL_ERROR.message, details: { requestId } } },
      { status: 500 },
    );
  }
}
