import "server-only";
import { spawn } from "node:child_process";
import { getServerConfig } from "@/lib/config/env.server";
import { AppError } from "@/lib/errors/app-error";

const TIMEOUT_MS = 30_000;
const MAX_STDOUT_BYTES = 64 * 1024 * 1024;

/** Extracts a single PNG frame at `tSec` via `ffmpeg -ss t -i src -frames:v 1 -f image2pipe -c:v png pipe:1`. */
export function grabFramePng(filePath: string, tSec: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const config = getServerConfig();
    const child = spawn(
      config.FFMPEG_PATH,
      ["-v", "error", "-ss", tSec.toFixed(3), "-i", filePath, "-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "pipe:1"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const chunks: Buffer[] = [];
    let bytes = 0;
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new AppError("VIDEO_UNREADABLE", { logDetail: { reason: "frame grab timed out" } }));
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > MAX_STDOUT_BYTES) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          child.kill("SIGKILL");
          reject(new AppError("VIDEO_UNREADABLE", { logDetail: { reason: "frame grab output exceeded cap" } }));
        }
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new AppError("VIDEO_UNREADABLE", { logDetail: { reason: err.message } }));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new AppError("VIDEO_UNREADABLE", { logDetail: { reason: "ffmpeg exit code", code, stderr: stderr.slice(0, 2000) } }));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });
}
