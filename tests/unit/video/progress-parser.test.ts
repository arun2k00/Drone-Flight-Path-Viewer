import { describe, expect, it } from "vitest";
import { FfmpegProgressParser } from "@/lib/video/progress-parser";

function block(fields: Record<string, string>, done = false): string {
  return (
    Object.entries(fields)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + `\nprogress=${done ? "end" : "continue"}\n`
  );
}

describe("FfmpegProgressParser", () => {
  it("parses a complete block", () => {
    const parser = new FfmpegProgressParser();
    const results = parser.push(block({ frame: "42", out_time_us: "2500000", fps: "29.5", speed: "1.25x" }));
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ frame: 42, outTimeSec: 2.5, fps: 29.5, speed: 1.25, done: false });
  });

  it("splits a block fed across two chunks mid-line", () => {
    const parser = new FfmpegProgressParser();
    const full = block({ frame: "10", out_time_us: "1000000", fps: "30", speed: "1x" });
    const cut = Math.floor(full.length / 2);
    const first = parser.push(full.slice(0, cut));
    expect(first).toHaveLength(0);
    const second = parser.push(full.slice(cut));
    expect(second).toHaveLength(1);
    expect(second[0].frame).toBe(10);
    expect(second[0].outTimeSec).toBe(1);
  });

  it("treats out_time_us=N/A as null, and falls back to out_time_ms", () => {
    const parser = new FfmpegProgressParser();
    const r1 = parser.push(block({ frame: "1", out_time_us: "N/A" }));
    expect(r1[0].outTimeSec).toBeNull();

    const r2 = parser.push(block({ frame: "2", out_time_ms: "3000000" }));
    expect(r2[0].outTimeSec).toBe(3);
  });

  it("clamps a negative out_time to 0", () => {
    const parser = new FfmpegProgressParser();
    const r = parser.push(block({ frame: "1", out_time_us: "-500000" }));
    expect(r[0].outTimeSec).toBe(0);
  });

  it("marks progress=end as done", () => {
    const parser = new FfmpegProgressParser();
    const r = parser.push(block({ frame: "100" }, true));
    expect(r[0].done).toBe(true);
  });

  it("treats speed=N/A as null", () => {
    const parser = new FfmpegProgressParser();
    const r = parser.push(block({ frame: "1", speed: "N/A" }));
    expect(r[0].speed).toBeNull();
  });

  it("emits one entry per block across multiple blocks in one push", () => {
    const parser = new FfmpegProgressParser();
    const combined = block({ frame: "1", out_time_us: "1000000" }) + block({ frame: "2", out_time_us: "2000000" }, true);
    const results = parser.push(combined);
    expect(results).toHaveLength(2);
    expect(results[0].frame).toBe(1);
    expect(results[1].frame).toBe(2);
    expect(results[1].done).toBe(true);
  });

  it("ignores blank lines and lines without an '='", () => {
    const parser = new FfmpegProgressParser();
    const noisy = "\n\nframe=5\nsome garbage line\nout_time_us=500000\nprogress=continue\n";
    const results = parser.push(noisy);
    expect(results).toHaveLength(1);
    expect(results[0].frame).toBe(5);
    expect(results[0].outTimeSec).toBe(0.5);
  });
});
