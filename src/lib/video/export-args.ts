import type { ExportSettings } from "@/types/api";
import type { AtlasLayout } from "@/lib/overlay/atlas";
import { COLOR_ALLOW, CRF_BY_QUALITY, VIDEO_CODEC_ARGS } from "./encoder-presets";

export interface ExportArgsInput {
  inputPath: string;
  staticPngPath: string | null;
  atlas: AtlasLayout | null;
  fps: { num: number; den: number };
  sourceStartTimeSec: number;
  source: { width: number; height: number };
  output: { width: number; height: number };
  audio: { codec: string } | null;
  quality: ExportSettings["quality"];
  color: { primaries: string | null; transfer: string | null; space: string | null };
  outputPath: string;
}

/** pure, shared with the atlas integration test. */
export function buildFilterGraph(i: ExportArgsInput): string {
  const parts: string[] = [];
  let cur = "0:v";
  let nextInput = 1;
  if (i.output.width !== i.source.width || i.output.height !== i.source.height) {
    parts.push(`[0:v]scale=${i.output.width}:${i.output.height}:flags=lanczos[base]`);
    cur = "base";
  }
  if (i.staticPngPath) {
    parts.push(`[${cur}][${nextInput}:v]overlay=0:0:format=auto[s0]`);
    cur = "s0";
    nextInput++;
  }
  if (i.atlas) {
    let atlas = `${nextInput}:v`;
    if (Math.abs(i.sourceStartTimeSec) > 1e-6) {
      parts.push(`[${atlas}]setpts=PTS+${i.sourceStartTimeSec.toFixed(6)}/TB[atl]`);
      atlas = "atl";
    }
    const n = i.atlas.slots.length;
    if (n > 1) parts.push(`[${atlas}]split=${n}${i.atlas.slots.map((_, k) => `[a${k}]`).join("")}`);
    i.atlas.slots.forEach((s, k) => {
      const src = n > 1 ? `a${k}` : atlas;
      parts.push(`[${src}]crop=${s.width}:${s.height}:0:${s.srcY}[e${k}]`);
      parts.push(`[${cur}][e${k}]overlay=${s.destX}:${s.destY}:format=auto:shortest=1[d${k}]`);
      cur = `d${k}`;
    });
  }
  parts.push(`[${cur}]format=yuv420p[vout]`);
  return parts.join(";");
}

/** Always maps the named [vout] label (never the whole first input stream); every path is its own argv element, no shell involved. */
export function buildExportArgs(i: ExportArgsInput): string[] {
  const args = ["-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-nostats", "-progress", "pipe:1", "-i", i.inputPath];
  if (i.staticPngPath) args.push("-i", i.staticPngPath);
  if (i.atlas) {
    args.push(
      "-f",
      "rawvideo",
      "-pixel_format",
      "rgba",
      "-video_size",
      `${i.atlas.width}x${i.atlas.height}`,
      "-framerate",
      `${i.fps.num}/${i.fps.den}`,
      "-i",
      "pipe:3",
    );
  }
  args.push("-filter_complex", buildFilterGraph(i), "-map", "[vout]");
  if (i.audio) args.push("-map", "0:a:0", ...(i.audio.codec === "aac" ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "192k"]));
  args.push(...VIDEO_CODEC_ARGS, "-crf", String(CRF_BY_QUALITY[i.quality]));
  if (i.color.primaries && (COLOR_ALLOW.primaries as readonly string[]).includes(i.color.primaries)) args.push("-color_primaries", i.color.primaries);
  if (i.color.transfer && (COLOR_ALLOW.transfer as readonly string[]).includes(i.color.transfer)) args.push("-color_trc", i.color.transfer);
  if (i.color.space && (COLOR_ALLOW.space as readonly string[]).includes(i.color.space)) args.push("-colorspace", i.color.space);
  args.push("-map_metadata", "0", "-map_chapters", "-1", "-movflags", "+faststart", i.outputPath);
  return args;
}
