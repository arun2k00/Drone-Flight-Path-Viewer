import { spawn } from "node:child_process";

let cached: Promise<boolean> | null = null;

function run(bin: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

/** Spawns `ffmpeg -version` once and caches the result — used to skip tests with a clear message when FFmpeg is missing. */
export function hasFfmpeg(): Promise<boolean> {
  cached ??= run(process.env.FFMPEG_PATH ?? "ffmpeg", ["-version"]);
  return cached;
}
