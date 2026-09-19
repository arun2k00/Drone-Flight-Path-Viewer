import "server-only";
import { spawn, type ChildProcess } from "node:child_process";
import type { Readable, Writable } from "node:stream";

export interface FfmpegProcess {
  child: ChildProcess;
  stdout: Readable;
  stderr: Readable;
  atlasPipe: Writable | null;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

const STDERR_RING_LIMIT = 256 * 1024;

/** No shell interpolation — args are a plain argv array passed directly to spawn. */
export function spawnFfmpeg(bin: string, args: string[], withAtlasPipe: boolean): FfmpegProcess {
  const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe", withAtlasPipe ? "pipe" : "ignore"], windowsHide: true });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject); // ENOENT -> FFMPEG_NOT_FOUND
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  return {
    child,
    stdout: child.stdout!,
    stderr: child.stderr!,
    atlasPipe: withAtlasPipe ? (child.stdio[3] as Writable) : null,
    exited,
  };
}

/** Collects the last STDERR_RING_LIMIT bytes of stderr text. Must always be attached — an unread pipe can fill up and block FFmpeg. */
export function collectStderrRing(proc: FfmpegProcess): { text(): string } {
  let ring = "";
  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (chunk: string) => {
    ring = (ring + chunk).slice(-STDERR_RING_LIMIT);
  });
  return { text: () => ring };
}

/** SIGTERM, then SIGKILL after 5s if the process hasn't exited. */
export async function killFfmpeg(proc: FfmpegProcess): Promise<void> {
  if (proc.child.exitCode !== null || proc.child.signalCode !== null) return;
  proc.child.kill("SIGTERM");
  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 5000));
  const result = await Promise.race([proc.exited.then(() => "exited" as const), timeout]);
  if (result === "timeout" && proc.child.exitCode === null && proc.child.signalCode === null) {
    proc.child.kill("SIGKILL");
    await proc.exited;
  }
}
