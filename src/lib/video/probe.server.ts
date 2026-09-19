import "server-only";
import { spawn } from "node:child_process";
import { getServerConfig } from "@/lib/config/env.server";
import { AppError } from "@/lib/errors/app-error";
import type { VideoMetadata } from "@/types/video";
import { parseFfprobeJson } from "./probe-parse";

const TIMEOUT_MS = 30_000;
const MAX_STDOUT_BYTES = 16 * 1024 * 1024;

function runFfprobe(bin: string, filePath: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new AppError("VIDEO_UNREADABLE", { logDetail: { reason: "ffprobe timed out" } }));
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          child.kill("SIGKILL");
          reject(new AppError("VIDEO_UNREADABLE", { logDetail: { reason: "ffprobe stdout exceeded cap" } }));
        }
        return;
      }
      stdout += chunk.toString("utf8");
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
        reject(
          new AppError("VIDEO_UNREADABLE", {
            logDetail: { reason: "ffprobe exit code", code, stderr: stderr.slice(0, 2000) },
          }),
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(
          new AppError("VIDEO_UNREADABLE", {
            logDetail: { reason: "ffprobe JSON parse error", err: err instanceof Error ? err.message : String(err) },
          }),
        );
      }
    });
  });
}

export async function probeVideo(filePath: string, sizeBytes: number): Promise<VideoMetadata> {
  const config = getServerConfig();
  const json = await runFfprobe(config.FFPROBE_PATH, filePath);
  return parseFfprobeJson(json, sizeBytes);
}
