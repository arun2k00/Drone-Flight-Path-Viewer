import "server-only";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { readEnv } from "@/lib/env-read";

const schema = z.object({
  DATABASE_URL: z.string().default("file:./storage/app.db"),
  STORAGE_PATH: z.string().default("./storage"),
  TEMP_PATH: z.string().optional(),
  MAX_VIDEO_SIZE_MB: z.coerce.number().int().positive().default(4096),
  MAX_SRT_SIZE_MB: z.coerce.number().int().positive().default(50),
  MAX_LOGO_SIZE_MB: z.coerce.number().int().positive().default(5),
  UPLOAD_CHUNK_SIZE_MB: z.coerce.number().int().min(1).max(256).default(32),
  FFMPEG_PATH: z.string().default("ffmpeg"),
  FFPROBE_PATH: z.string().default("ffprobe"),
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().optional(),
  NEXT_PUBLIC_SATELLITE_STYLE_URL: z.string().optional(),
  OVERLAY_MAP_TILE_URL: z.string().optional(),
  OVERLAY_MAP_TILE_ATTRIBUTION: z.string().optional(),
  OVERLAY_SATELLITE_TILE_URL: z.string().optional(),
  OVERLAY_SATELLITE_TILE_ATTRIBUTION: z.string().optional(),
  MAP_TILE_USER_AGENT: z.string().default("Aeroxpress/1.0 (self-hosted)"),
  // z.coerce.boolean() treats the string "false" as truthy, so parse the literal values instead.
  ENABLE_DIAGNOSTICS: z.enum(["true", "false"]).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  APP_URL: z.url().default("http://localhost:3470"),
  ADMIN_EMAIL: z.email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Aeroxpress <no-reply@aeroxpress.local>"),
});

export interface ServerConfig {
  DATABASE_URL: string;
  STORAGE_PATH: string;
  TEMP_PATH: string;
  MAX_VIDEO_SIZE_MB: number;
  MAX_SRT_SIZE_MB: number;
  MAX_LOGO_SIZE_MB: number;
  UPLOAD_CHUNK_SIZE_MB: number;
  FFMPEG_PATH: string;
  FFPROBE_PATH: string;
  NEXT_PUBLIC_MAP_STYLE_URL: string | null;
  NEXT_PUBLIC_SATELLITE_STYLE_URL: string | null;
  OVERLAY_MAP_TILE_URL: string | null;
  OVERLAY_MAP_TILE_ATTRIBUTION: string | null;
  OVERLAY_SATELLITE_TILE_URL: string | null;
  OVERLAY_SATELLITE_TILE_ATTRIBUTION: string | null;
  MAP_TILE_USER_AGENT: string;
  ENABLE_DIAGNOSTICS: boolean;
  LOG_LEVEL: "debug" | "info" | "warn" | "error";
  /** Public base URL used in emails and share links, no trailing slash. */
  APP_URL: string;
  /** Signing up with this email makes the account an admin (the first account ever is an admin too). */
  ADMIN_EMAIL: string | null;
  /** null = no SMTP; emails are written to <STORAGE_PATH>/outbox instead. */
  SMTP: { host: string; port: number; secure: boolean; user: string | null; pass: string | null } | null;
  MAIL_FROM: string;
}

let cached: ServerConfig | null = null;

/** Parses every server env var once with zod (readEnv keeps the access dynamic). Throws a readable error on invalid values — fatal at startup. */
export function getServerConfig(): ServerConfig {
  if (cached) return cached;

  const raw = {
    DATABASE_URL: readEnv("DATABASE_URL"),
    STORAGE_PATH: readEnv("STORAGE_PATH"),
    TEMP_PATH: readEnv("TEMP_PATH"),
    MAX_VIDEO_SIZE_MB: readEnv("MAX_VIDEO_SIZE_MB"),
    MAX_SRT_SIZE_MB: readEnv("MAX_SRT_SIZE_MB"),
    MAX_LOGO_SIZE_MB: readEnv("MAX_LOGO_SIZE_MB"),
    UPLOAD_CHUNK_SIZE_MB: readEnv("UPLOAD_CHUNK_SIZE_MB"),
    FFMPEG_PATH: readEnv("FFMPEG_PATH"),
    FFPROBE_PATH: readEnv("FFPROBE_PATH"),
    NEXT_PUBLIC_MAP_STYLE_URL: readEnv("NEXT_PUBLIC_MAP_STYLE_URL"),
    NEXT_PUBLIC_SATELLITE_STYLE_URL: readEnv("NEXT_PUBLIC_SATELLITE_STYLE_URL"),
    OVERLAY_MAP_TILE_URL: readEnv("OVERLAY_MAP_TILE_URL"),
    OVERLAY_MAP_TILE_ATTRIBUTION: readEnv("OVERLAY_MAP_TILE_ATTRIBUTION"),
    OVERLAY_SATELLITE_TILE_URL: readEnv("OVERLAY_SATELLITE_TILE_URL"),
    OVERLAY_SATELLITE_TILE_ATTRIBUTION: readEnv("OVERLAY_SATELLITE_TILE_ATTRIBUTION"),
    MAP_TILE_USER_AGENT: readEnv("MAP_TILE_USER_AGENT"),
    ENABLE_DIAGNOSTICS: readEnv("ENABLE_DIAGNOSTICS"),
    LOG_LEVEL: readEnv("LOG_LEVEL"),
    APP_URL: readEnv("APP_URL"),
    ADMIN_EMAIL: readEnv("ADMIN_EMAIL"),
    SMTP_HOST: readEnv("SMTP_HOST"),
    SMTP_PORT: readEnv("SMTP_PORT"),
    SMTP_SECURE: readEnv("SMTP_SECURE"),
    SMTP_USER: readEnv("SMTP_USER"),
    SMTP_PASS: readEnv("SMTP_PASS"),
    MAIL_FROM: readEnv("MAIL_FROM"),
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    throw new Error(`Invalid environment configuration: ${JSON.stringify(flattened.fieldErrors)}`);
  }

  const data = parsed.data;
  cached = {
    DATABASE_URL: data.DATABASE_URL,
    STORAGE_PATH: data.STORAGE_PATH,
    TEMP_PATH: data.TEMP_PATH ?? path.join(os.tmpdir(), "drone-telemetry"),
    MAX_VIDEO_SIZE_MB: data.MAX_VIDEO_SIZE_MB,
    MAX_SRT_SIZE_MB: data.MAX_SRT_SIZE_MB,
    MAX_LOGO_SIZE_MB: data.MAX_LOGO_SIZE_MB,
    UPLOAD_CHUNK_SIZE_MB: data.UPLOAD_CHUNK_SIZE_MB,
    FFMPEG_PATH: data.FFMPEG_PATH,
    FFPROBE_PATH: data.FFPROBE_PATH,
    NEXT_PUBLIC_MAP_STYLE_URL: data.NEXT_PUBLIC_MAP_STYLE_URL ?? null,
    NEXT_PUBLIC_SATELLITE_STYLE_URL: data.NEXT_PUBLIC_SATELLITE_STYLE_URL ?? null,
    OVERLAY_MAP_TILE_URL: data.OVERLAY_MAP_TILE_URL ?? null,
    OVERLAY_MAP_TILE_ATTRIBUTION: data.OVERLAY_MAP_TILE_ATTRIBUTION ?? null,
    OVERLAY_SATELLITE_TILE_URL: data.OVERLAY_SATELLITE_TILE_URL ?? null,
    OVERLAY_SATELLITE_TILE_ATTRIBUTION: data.OVERLAY_SATELLITE_TILE_ATTRIBUTION ?? null,
    MAP_TILE_USER_AGENT: data.MAP_TILE_USER_AGENT,
    ENABLE_DIAGNOSTICS: data.ENABLE_DIAGNOSTICS === undefined ? process.env.NODE_ENV !== "production" : data.ENABLE_DIAGNOSTICS === "true",
    LOG_LEVEL: data.LOG_LEVEL,
    APP_URL: data.APP_URL.replace(/\/+$/, ""),
    ADMIN_EMAIL: data.ADMIN_EMAIL?.toLowerCase() ?? null,
    SMTP: data.SMTP_HOST
      ? {
          host: data.SMTP_HOST,
          port: data.SMTP_PORT,
          secure: data.SMTP_SECURE === undefined ? data.SMTP_PORT === 465 : data.SMTP_SECURE === "true",
          user: data.SMTP_USER ?? null,
          pass: data.SMTP_PASS ?? null,
        }
      : null,
    MAIL_FROM: data.MAIL_FROM,
  };
  return cached;
}
