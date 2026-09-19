import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").trim().toLowerCase();
  return raw === "debug" || raw === "info" || raw === "warn" || raw === "error" ? raw : "info";
}

export interface LogFields {
  requestId?: string;
  jobId?: string;
  projectId?: string;
  err?: { name?: string; message: string; stack?: string };
  [key: string]: unknown;
}

function write(level: LogLevel, scope: string, msg: string, fields?: LogFields): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel()]) return;
  const line = { time: new Date().toISOString(), level, scope, msg, ...fields };
  const out = JSON.stringify(line);
  if (level === "error" || level === "warn") {
    console.error(out);
  } else {
    console.log(out);
  }
}

export const logger = {
  debug: (scope: string, msg: string, fields?: LogFields) => write("debug", scope, msg, fields),
  info: (scope: string, msg: string, fields?: LogFields) => write("info", scope, msg, fields),
  warn: (scope: string, msg: string, fields?: LogFields) => write("warn", scope, msg, fields),
  error: (scope: string, msg: string, fields?: LogFields) => write("error", scope, msg, fields),
};
