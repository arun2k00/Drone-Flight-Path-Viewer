import { describe, expect, it } from "vitest";
import { buildExportArgs, buildFilterGraph, type ExportArgsInput } from "@/lib/video/export-args";
import type { AtlasLayout } from "@/lib/overlay/atlas";

function mkInput(overrides: Partial<ExportArgsInput> = {}): ExportArgsInput {
  return {
    inputPath: "/tmp/src.mp4",
    staticPngPath: null,
    atlas: null,
    fps: { num: 30000, den: 1001 },
    sourceStartTimeSec: 0,
    source: { width: 1920, height: 1080 },
    output: { width: 1920, height: 1080 },
    audio: null,
    quality: "high",
    color: { primaries: null, transfer: null, space: null },
    outputPath: "/tmp/out.mp4",
    ...overrides,
  };
}

const ATLAS_3: AtlasLayout = {
  width: 896,
  height: 1332,
  slots: [
    { elementId: "miniMap", srcY: 0, width: 896, height: 640, destX: 2880, destY: 86 },
    { elementId: "telemetryPanel", srcY: 640, width: 764, height: 564, destX: 104, destY: 1492 },
    { elementId: "headingIndicator", srcY: 1204, width: 764, height: 128, destX: 1538, destY: 1928 },
  ],
};

describe("buildExportArgs invariants", () => {
  it("never passes -map 0 (always the named [vout] label or an explicit stream selector)", () => {
    const args = buildExportArgs(mkInput({ atlas: ATLAS_3, staticPngPath: "/tmp/static.png", audio: { codec: "aac" } }));
    const mapIndexes = args.reduce<number[]>((acc, v, i) => (v === "-map" ? [...acc, i] : acc), []);
    expect(mapIndexes.length).toBeGreaterThan(0);
    for (const i of mapIndexes) expect(args[i + 1]).not.toBe("0");
  });

  it("adds the pipe:3 rawvideo input only when an atlas is present", () => {
    const withAtlas = buildExportArgs(mkInput({ atlas: ATLAS_3 }));
    expect(withAtlas).toContain("pipe:3");
    expect(withAtlas).toContain("rawvideo");

    const withoutAtlas = buildExportArgs(mkInput({ atlas: null }));
    expect(withoutAtlas).not.toContain("pipe:3");
    expect(withoutAtlas).not.toContain("rawvideo");
  });

  it("every dynamic overlay carries shortest=1; the static overlay never does", () => {
    const graph = buildFilterGraph(mkInput({ atlas: ATLAS_3, staticPngPath: "/tmp/static.png" }));
    // The static overlay segment is "[cur][nextInput:v]overlay=0:0:format=auto[s0]" and must not contain shortest=1.
    const staticSeg = graph.split(";").find((p) => /overlay=0:0:format=auto\[s0\]/.test(p));
    expect(staticSeg).toBeDefined();
    expect(staticSeg).not.toMatch(/shortest=1/);

    const dynamicSegs = graph.split(";").filter((p) => /overlay=\d+:\d+:format=auto:shortest=1/.test(p));
    expect(dynamicSegs).toHaveLength(3);
  });

  it("scale is present only when output size differs from source", () => {
    const same = buildFilterGraph(mkInput({ output: { width: 1920, height: 1080 } }));
    expect(same).not.toContain("scale=");

    const scaled = buildFilterGraph(mkInput({ output: { width: 1280, height: 720 } }));
    expect(scaled).toContain("scale=1280:720:flags=lanczos");
  });

  it("setpts is present only when sourceStartTimeSec is non-zero", () => {
    const noOffset = buildFilterGraph(mkInput({ atlas: ATLAS_3, sourceStartTimeSec: 0 }));
    expect(noOffset).not.toContain("setpts=");

    const withOffset = buildFilterGraph(mkInput({ atlas: ATLAS_3, sourceStartTimeSec: 0.5 }));
    expect(withOffset).toContain("setpts=PTS+0.500000/TB");
  });

  it("audio: copy when aac, transcode otherwise, absent when no audio", () => {
    const aac = buildExportArgs(mkInput({ audio: { codec: "aac" } }));
    expect(aac).toEqual(expect.arrayContaining(["-map", "0:a:0", "-c:a", "copy"]));

    const other = buildExportArgs(mkInput({ audio: { codec: "pcm_s16le" } }));
    expect(other).toEqual(expect.arrayContaining(["-c:a", "aac", "-b:a", "192k"]));

    const none = buildExportArgs(mkInput({ audio: null }));
    expect(none).not.toContain("-c:a");
    expect(none.filter((v) => v === "0:a:0")).toHaveLength(0);
  });

  it("CRF follows the quality setting", () => {
    expect(buildExportArgs(mkInput({ quality: "high" }))).toEqual(expect.arrayContaining(["-crf", "18"]));
    expect(buildExportArgs(mkInput({ quality: "balanced" }))).toEqual(expect.arrayContaining(["-crf", "21"]));
    expect(buildExportArgs(mkInput({ quality: "small" }))).toEqual(expect.arrayContaining(["-crf", "24"]));
  });

  it("colour tags pass through only when allow-listed, and are omitted otherwise", () => {
    const allowed = buildExportArgs(mkInput({ color: { primaries: "bt709", transfer: "bt709", space: "bt709" } }));
    expect(allowed).toEqual(expect.arrayContaining(["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"]));

    const disallowed = buildExportArgs(mkInput({ color: { primaries: "unknown", transfer: "unknown", space: "unknown" } }));
    expect(disallowed).not.toContain("-color_primaries");
    expect(disallowed).not.toContain("-color_trc");
    expect(disallowed).not.toContain("-colorspace");

    const absent = buildExportArgs(mkInput({ color: { primaries: null, transfer: null, space: null } }));
    expect(absent).not.toContain("-color_primaries");
  });

  it("matches the documented filtergraph shape for a 4K source with static + 3 dynamic elements", () => {
    const graph = buildFilterGraph(
      mkInput({ atlas: ATLAS_3, staticPngPath: "/tmp/static.png", source: { width: 3840, height: 2160 }, output: { width: 3840, height: 2160 } }),
    );
    expect(graph).toBe(
      "[0:v][1:v]overlay=0:0:format=auto[s0];" +
        "[2:v]split=3[a0][a1][a2];" +
        "[a0]crop=896:640:0:0[e0];[s0][e0]overlay=2880:86:format=auto:shortest=1[d0];" +
        "[a1]crop=764:564:0:640[e1];[d0][e1]overlay=104:1492:format=auto:shortest=1[d1];" +
        "[a2]crop=764:128:0:1204[e2];[d1][e2]overlay=1538:1928:format=auto:shortest=1[d2];" +
        "[d2]format=yuv420p[vout]",
    );
  });

  it("never uses shell:true-style string concatenation — every arg is a separate argv element with no spaces smuggling extra flags", () => {
    const args = buildExportArgs(mkInput({ atlas: ATLAS_3, staticPngPath: "/tmp/static.png", audio: { codec: "aac" } }));
    for (const a of args) expect(typeof a).toBe("string");
    // the input/output paths never got merged with a flag into one token
    expect(args).toContain("/tmp/src.mp4");
    expect(args).toContain("/tmp/out.mp4");
    expect(args).toContain("/tmp/static.png");
  });

  it("dimensions and the start-time offset in the filtergraph are plain integers / toFixed(6) — never raw user text", () => {
    const graph = buildFilterGraph(mkInput({ atlas: ATLAS_3, sourceStartTimeSec: 1.23456789 }));
    expect(graph).toContain("setpts=PTS+1.234568/TB");
    for (const slot of ATLAS_3.slots) {
      expect(graph).toContain(`crop=${slot.width}:${slot.height}:0:${slot.srcY}`);
    }
  });
});
