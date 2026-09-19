import "server-only";
import { AppError } from "@/lib/errors/app-error";

const hits = new Map<string, { count: number; resetAt: number }>();

/** In-memory, per process. Fine for one container; move to the DB or Redis if the app is scaled out. */
export function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    return;
  }
  if (++entry.count > max) throw new AppError("RATE_LIMITED");
}
