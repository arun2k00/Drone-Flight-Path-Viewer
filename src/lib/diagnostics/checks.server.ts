import "server-only";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
import { getServerConfig } from "@/lib/config/env.server";
import { prisma } from "@/lib/db.server";
import { getStorage } from "@/lib/storage/index.server";
import { statfsFree } from "@/lib/storage/filesystem.server";
import { getPublicConfig } from "@/lib/config/public-config.server";
import { registerOverlayFonts } from "@/lib/overlay/assets.server";
import { font } from "@/lib/overlay/fonts";
import { AIR3S_FIXTURE_SRT } from "./fixture";
import { parseTelemetry } from "@/lib/telemetry/parser";

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string | null;
}

const PER_CHECK_TIMEOUT_MS = 5000;

function runProcess(bin: string, args: string[], timeoutMs = PER_CHECK_TIMEOUT_MS): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve({ code: null, stdout, stderr: `${stderr}\n(timed out after ${timeoutMs}ms)` });
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: err.message });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function withDetail(detailsEnabled: boolean, detail: string): string | null {
  return detailsEnabled ? detail : null;
}

async function checkFfmpeg(config: ReturnType<typeof getServerConfig>, detailsEnabled: boolean): Promise<DiagnosticCheck> {
  const version = await runProcess(config.FFMPEG_PATH, ["-hide_banner", "-version"]);
  if (version.code !== 0) {
    return { id: "ffmpeg", label: "FFmpeg", status: "fail", detail: withDetail(detailsEnabled, version.stderr || "ffmpeg not found") };
  }
  const versionLine = version.stdout.split("\n")[0] ?? "ffmpeg";
  const [encoders, filters] = await Promise.all([
    runProcess(config.FFMPEG_PATH, ["-hide_banner", "-encoders"]),
    runProcess(config.FFMPEG_PATH, ["-hide_banner", "-filters"]),
  ]);
  const hasLibx264 = encoders.stdout.includes("libx264");
  const hasAac = encoders.stdout.includes("aac");
  const hasFilters = ["overlay", "crop", "split", "scale"].every((f) => filters.stdout.includes(f));
  if (!hasLibx264 || !hasAac || !hasFilters) {
    return {
      id: "ffmpeg",
      label: "FFmpeg",
      status: "fail",
      detail: withDetail(detailsEnabled, `${versionLine} — missing ${!hasLibx264 ? "libx264 " : ""}${!hasAac ? "aac " : ""}${!hasFilters ? "filters" : ""}`.trim()),
    };
  }
  return { id: "ffmpeg", label: "FFmpeg", status: "ok", detail: withDetail(detailsEnabled, versionLine) };
}

async function checkFfprobe(config: ReturnType<typeof getServerConfig>, detailsEnabled: boolean): Promise<DiagnosticCheck> {
  const result = await runProcess(config.FFPROBE_PATH, ["-version"]);
  if (result.code !== 0) {
    return { id: "ffprobe", label: "FFprobe", status: "fail", detail: withDetail(detailsEnabled, result.stderr || "ffprobe not found") };
  }
  const versionLine = result.stdout.split("\n")[0] ?? "ffprobe";
  return { id: "ffprobe", label: "FFprobe", status: "ok", detail: withDetail(detailsEnabled, versionLine) };
}

function checkNode(detailsEnabled: boolean): DiagnosticCheck {
  const nodeVersion = process.versions.node;
  const [major, minor] = nodeVersion.split(".").map(Number);
  const ok = major > 22 || (major === 22 && minor >= 12);
  return {
    id: "node",
    label: "Node",
    status: ok ? "ok" : "fail",
    detail: withDetail(detailsEnabled, `v${nodeVersion}`),
  };
}

async function checkStorage(config: ReturnType<typeof getServerConfig>, detailsEnabled: boolean): Promise<DiagnosticCheck> {
  try {
    const storage = getStorage();
    const probeKey = `diagnostics/${randomUUID()}.probe`;
    await storage.save(probeKey, "ok");
    const buf = await storage.readBuffer(probeKey);
    await storage.delete(probeKey);
    if (Buffer.from(buf).toString("utf8") !== "ok") {
      return { id: "storage", label: "Storage", status: "fail", detail: withDetail(detailsEnabled, "probe read/write mismatch") };
    }
    const freeBytes = await statfsFree(config.STORAGE_PATH);
    const freeGb = freeBytes / 1024 ** 3;
    const status = freeGb < 5 ? "warn" : "ok";
    return { id: "storage", label: "Storage", status, detail: withDetail(detailsEnabled, `${freeGb.toFixed(1)} GB free`) };
  } catch (err) {
    return { id: "storage", label: "Storage", status: "fail", detail: withDetail(detailsEnabled, err instanceof Error ? err.message : String(err)) };
  }
}

async function checkDatabase(detailsEnabled: boolean): Promise<DiagnosticCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const count = await prisma.project.count();
    return { id: "database", label: "Database", status: "ok", detail: withDetail(detailsEnabled, `${count} project(s)`) };
  } catch (err) {
    return { id: "database", label: "Database", status: "fail", detail: withDetail(detailsEnabled, err instanceof Error ? err.message : String(err)) };
  }
}

function checkTelemetryParser(detailsEnabled: boolean): DiagnosticCheck {
  try {
    const parsed = parseTelemetry(AIR3S_FIXTURE_SRT, { coordinateOrder: "auto" });
    const ok = parsed.report.parsedRecords === 30 && parsed.summary.capabilities.gps;
    return {
      id: "telemetry-parser",
      label: "Telemetry parser",
      status: ok ? "ok" : "fail",
      detail: withDetail(detailsEnabled, `${parsed.report.parserId}: ${parsed.report.parsedRecords} records, GPS ${parsed.summary.capabilities.gps ? "✓" : "✗"}`),
    };
  } catch (err) {
    return { id: "telemetry-parser", label: "Telemetry parser", status: "fail", detail: withDetail(detailsEnabled, err instanceof Error ? err.message : String(err)) };
  }
}

async function checkMap(detailsEnabled: boolean): Promise<DiagnosticCheck> {
  const publicConfig = getPublicConfig();
  const styleSource = publicConfig.map.styleUrl ?? "OSM default (fallback raster)";
  const overlayConfigured = publicConfig.overlayBasemaps.map || publicConfig.overlayBasemaps.satellite;
  const sampleTileUrl = publicConfig.map.fallbackRaster.tiles[0]?.replace("{z}", "1").replace("{x}", "0").replace("{y}", "0");
  if (!sampleTileUrl) {
    return { id: "map", label: "Map", status: "fail", detail: withDetail(detailsEnabled, "no fallback raster tile URL configured") };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(sampleTileUrl, { method: "HEAD", signal: controller.signal }).finally(() => clearTimeout(timer));
    const status = res.ok ? "ok" : "warn";
    return {
      id: "map",
      label: "Map",
      status,
      detail: withDetail(detailsEnabled, `style: ${styleSource}; overlay basemap: ${overlayConfigured ? "yes" : "no"}; tile HEAD ${res.status}`),
    };
  } catch (err) {
    return {
      id: "map",
      label: "Map",
      status: "warn",
      detail: withDetail(detailsEnabled, `style: ${styleSource}; overlay basemap: ${overlayConfigured ? "yes" : "no"}; tile unreachable (${err instanceof Error ? err.message : String(err)})`),
    };
  }
}

/** Registers fonts, renders a small panel with @napi-rs/canvas and checks a real monospace font loaded. */
function checkOverlayRenderer(detailsEnabled: boolean): DiagnosticCheck {
  try {
    registerOverlayFonts();
    const canvas = createCanvas(320, 120);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "#0B0D10";
    ctx.fillRect(0, 0, 320, 120);
    ctx.fillStyle = "#F3F5F7";
    ctx.textBaseline = "middle";
    ctx.font = font("DTS Mono Medium", 32);
    ctx.fillText("ALT 42.7 m", 12, 60);

    // A genuine monospace font renders every glyph at the same advance width; the fallback sans-serif doesn't.
    ctx.font = font("DTS Mono Medium", 48);
    const wWidth = ctx.measureText("WWWW").width;
    const iWidth = ctx.measureText("iiii").width;
    const monospaceLoaded = Math.abs(wWidth - iWidth) < 0.5;

    return {
      id: "overlay-renderer",
      label: "Overlay renderer",
      status: monospaceLoaded ? "ok" : "fail",
      detail: withDetail(detailsEnabled, `WWWW ${wWidth.toFixed(1)}px, iiii ${iWidth.toFixed(1)}px`),
    };
  } catch (err) {
    return { id: "overlay-renderer", label: "Overlay renderer", status: "fail", detail: withDetail(detailsEnabled, err instanceof Error ? err.message : String(err)) };
  }
}

export async function runDiagnostics(): Promise<DiagnosticCheck[]> {
  const config = getServerConfig();
  const detailsEnabled = config.ENABLE_DIAGNOSTICS;
  const [ffmpeg, ffprobe, storage, database, map] = await Promise.all([
    checkFfmpeg(config, detailsEnabled),
    checkFfprobe(config, detailsEnabled),
    checkStorage(config, detailsEnabled),
    checkDatabase(detailsEnabled),
    checkMap(detailsEnabled),
  ]);
  return [ffmpeg, ffprobe, checkNode(detailsEnabled), storage, database, checkTelemetryParser(detailsEnabled), checkOverlayRenderer(detailsEnabled), map];
}
