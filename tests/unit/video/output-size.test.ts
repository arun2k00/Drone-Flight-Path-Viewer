import { describe, expect, it } from "vitest";
import { computeOutputSize, resolutionOptions } from "@/lib/video/output-size";

describe("computeOutputSize", () => {
  it("3840x2160: original unchanged, 1080p fits, 2160p unchanged", () => {
    const src = { width: 3840, height: 2160 };
    expect(computeOutputSize(src, "original")).toEqual({ width: 3840, height: 2160, scaled: false });
    expect(computeOutputSize(src, "1080p")).toEqual({ width: 1920, height: 1080, scaled: true });
    expect(computeOutputSize(src, "2160p")).toEqual({ width: 3840, height: 2160, scaled: false });
  });

  it("1920x1080: original and 1080p unchanged, 2160p unavailable", () => {
    const src = { width: 1920, height: 1080 };
    expect(computeOutputSize(src, "original")).toEqual({ width: 1920, height: 1080, scaled: false });
    expect(computeOutputSize(src, "1080p")).toEqual({ width: 1920, height: 1080, scaled: false });
    expect(computeOutputSize(src, "2160p")).toEqual({ error: "RESOLUTION_UNAVAILABLE" });
  });

  it("1080x1920 (portrait): original and 1080p unchanged, 2160p unavailable", () => {
    const src = { width: 1080, height: 1920 };
    expect(computeOutputSize(src, "original")).toEqual({ width: 1080, height: 1920, scaled: false });
    expect(computeOutputSize(src, "1080p")).toEqual({ width: 1080, height: 1920, scaled: false });
    expect(computeOutputSize(src, "2160p")).toEqual({ error: "RESOLUTION_UNAVAILABLE" });
  });

  it("2160x3840 (4K portrait): original unchanged, 1080p fits, 2160p unchanged", () => {
    const src = { width: 2160, height: 3840 };
    expect(computeOutputSize(src, "original")).toEqual({ width: 2160, height: 3840, scaled: false });
    expect(computeOutputSize(src, "1080p")).toEqual({ width: 1080, height: 1920, scaled: true });
    expect(computeOutputSize(src, "2160p")).toEqual({ width: 2160, height: 3840, scaled: false });
  });

  it("2688x1512 (2.7K): 1080p scales to 1920x1080, 2160p unavailable", () => {
    const src = { width: 2688, height: 1512 };
    expect(computeOutputSize(src, "original")).toEqual({ width: 2688, height: 1512, scaled: false });
    expect(computeOutputSize(src, "1080p")).toEqual({ width: 1920, height: 1080, scaled: true });
    expect(computeOutputSize(src, "2160p")).toEqual({ error: "RESOLUTION_UNAVAILABLE" });
  });

  it("1279x719: original rounds down to even, 1080p and 2160p unavailable", () => {
    const src = { width: 1279, height: 719 };
    expect(computeOutputSize(src, "original")).toEqual({ width: 1278, height: 718, scaled: true });
    expect(computeOutputSize(src, "1080p")).toEqual({ error: "RESOLUTION_UNAVAILABLE" });
    expect(computeOutputSize(src, "2160p")).toEqual({ error: "RESOLUTION_UNAVAILABLE" });
  });

  it("never upscales: a short side exactly at the threshold is available, one below is not", () => {
    expect(computeOutputSize({ width: 1920, height: 1080 }, "1080p")).toMatchObject({ scaled: false });
    expect(computeOutputSize({ width: 1918, height: 1078 }, "1080p")).toEqual({ error: "RESOLUTION_UNAVAILABLE" });
    expect(computeOutputSize({ width: 3840, height: 2160 }, "2160p")).toMatchObject({ scaled: false });
    expect(computeOutputSize({ width: 3838, height: 2158 }, "2160p")).toEqual({ error: "RESOLUTION_UNAVAILABLE" });
  });
});

describe("resolutionOptions", () => {
  it("marks unavailable options with a reason and null dimensions", () => {
    const opts = resolutionOptions({ width: 1920, height: 1080 });
    const original = opts.find((o) => o.value === "original")!;
    const p2160 = opts.find((o) => o.value === "2160p")!;
    expect(original).toMatchObject({ available: true, width: 1920, height: 1080, reason: null });
    expect(p2160.available).toBe(false);
    expect(p2160.width).toBeNull();
    expect(p2160.reason).toMatch(/no upscaling/);
  });

  it("lists all three resolutions", () => {
    const opts = resolutionOptions({ width: 3840, height: 2160 });
    expect(opts.map((o) => o.value)).toEqual(["original", "1080p", "2160p"]);
    expect(opts.every((o) => o.available)).toBe(true);
  });
});
