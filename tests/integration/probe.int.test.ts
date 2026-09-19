import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { probeVideo } from "@/lib/video/probe.server";
import { generateSyntheticVideo } from "../helpers/synthetic-video";

describe("probeVideo (real ffprobe)", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), "dts-probe-test-"));
  });

  afterAll(async () => {
    await fsp.rm(dir, { recursive: true, force: true });
  });

  it("probes a 720p30 file with no audio", async () => {
    const file = path.join(dir, "720p30.mp4");
    await generateSyntheticVideo(file, { width: 1280, height: 720, fps: "30", durationSec: 3 });
    const stat = await fsp.stat(file);
    const meta = await probeVideo(file, stat.size);

    expect(meta.video.codec).toBe("h264");
    expect(meta.video.width).toBe(1280);
    expect(meta.video.height).toBe(720);
    expect(meta.video.fps.value).toBeCloseTo(30, 5);
    expect(meta.video.frameCount).toBe(90);
    expect(meta.video.bitDepth).toBe(8);
    expect(meta.audio).toBeNull();
    expect(meta.sizeBytes).toBe(stat.size);
  });

  it("probes a 4K25 HEVC Main10 file with bitDepth 10", async () => {
    const file = path.join(dir, "4k25hevc10.mp4");
    await generateSyntheticVideo(file, {
      width: 3840,
      height: 2160,
      fps: "25",
      durationSec: 3,
      codec: "libx265",
      pixelFormat: "yuv420p10le",
      extraArgs: ["-tag:v", "hvc1"],
    });
    const stat = await fsp.stat(file);
    const meta = await probeVideo(file, stat.size);

    expect(meta.video.codec).toBe("hevc");
    expect(meta.video.bitDepth).toBe(10);
    expect(meta.video.width).toBe(3840);
    expect(meta.video.height).toBe(2160);
  }, 60_000);
});
