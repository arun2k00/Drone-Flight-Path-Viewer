import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

function run(bin: string, args: string[]): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) => resolve(code));
  });
}

describe("ffmpeg binary", () => {
  it("is installed and runnable", async () => {
    const code = await run(process.env.FFMPEG_PATH ?? "ffmpeg", ["-version"]);
    expect(code).toBe(0);
  });
});
