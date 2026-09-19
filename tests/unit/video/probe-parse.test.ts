import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { parseFfprobeJson } from "@/lib/video/probe-parse";

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(process.cwd(), "tests/fixtures/ffprobe", name), "utf8"));
}

describe("parseFfprobeJson", () => {
  it("parses a standard 1080p29.97 H.264+AAC file", () => {
    const meta = parseFfprobeJson(loadFixture("e2e-1080p2997-aac.json"), 8_691_940);
    expect(meta.video.codec).toBe("h264");
    expect(meta.video.width).toBe(1920);
    expect(meta.video.height).toBe(1080);
    expect(meta.video.fps.num).toBe(30000);
    expect(meta.video.fps.den).toBe(1001);
    expect(meta.video.fps.value).toBeCloseTo(29.97, 2);
    expect(meta.video.frameCount).toBe(359);
    expect(meta.video.bitDepth).toBe(8);
    expect(meta.audio).not.toBeNull();
    expect(meta.audio?.codec).toBe("aac");
    expect(meta.audio?.sampleRate).toBe(48000);
    expect(meta.sizeBytes).toBe(8_691_940);
  });

  it("parses a 720p30 file with no audio track", () => {
    const meta = parseFfprobeJson(loadFixture("720p30-noaudio.json"), 1_038_389);
    expect(meta.video.width).toBe(1280);
    expect(meta.video.height).toBe(720);
    expect(meta.video.fps.value).toBe(30);
    expect(meta.audio).toBeNull();
  });

  it("detects 10-bit HEVC from pix_fmt when bits_per_raw_sample is absent", () => {
    const meta = parseFfprobeJson(loadFixture("4k25-hevc10.json"), 6_012_524);
    expect(meta.video.codec).toBe("hevc");
    expect(meta.video.width).toBe(3840);
    expect(meta.video.height).toBe(2160);
    expect(meta.video.bitDepth).toBe(10);
  });

  it("throws VIDEO_UNREADABLE when there is no video stream", () => {
    try {
      parseFfprobeJson({ format: {}, streams: [] }, 100);
      throw new Error("expected parseFfprobeJson to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("VIDEO_UNREADABLE");
    }
  });
});
