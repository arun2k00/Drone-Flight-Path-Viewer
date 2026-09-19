import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Grabs one frame's rect as raw RGB24 bytes via ffmpeg crop — used to compare regions between frames/files. */
export async function grabRegionRgb(videoPath: string, tSec: number, rect: PixelRect): Promise<Buffer> {
  const { stdout } = await execFileP(
    process.env.FFMPEG_PATH ?? "ffmpeg",
    [
      "-v",
      "error",
      "-ss",
      String(tSec),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-vf",
      `crop=${rect.width}:${rect.height}:${rect.x}:${rect.y}`,
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ],
    { encoding: "buffer", maxBuffer: 512 * 1024 * 1024 },
  );
  return stdout;
}

/** Mean absolute per-byte difference between two equally-sized buffers. */
export function meanAbsDiff(a: Buffer, b: Buffer): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}
