import { spawn } from "node:child_process";

export interface SyntheticVideoSpec {
  width: number;
  height: number;
  fps: string; // e.g. "30000/1001" or "30"
  durationSec: number;
  withAudio?: boolean;
  codec?: "libx264" | "libx265";
  pixelFormat?: string;
  extraArgs?: string[];
}

/** Renders a synthetic test pattern with ffmpeg (integration tests only — not shared/unit-safe). */
export function generateSyntheticVideo(outPath: string, spec: SyntheticVideoSpec): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `testsrc2=size=${spec.width}x${spec.height}:rate=${spec.fps}`,
    ];
    if (spec.withAudio) args.push("-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000");
    args.push("-t", String(spec.durationSec), "-c:v", spec.codec ?? "libx264", "-preset", "veryfast", "-pix_fmt", spec.pixelFormat ?? "yuv420p");
    if (spec.withAudio) args.push("-c:a", "aac", "-b:a", "128k", "-shortest");
    if (spec.extraArgs) args.push(...spec.extraArgs);
    args.push(outPath);

    const child = spawn(process.env.FFMPEG_PATH ?? "ffmpeg", args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
  });
}
