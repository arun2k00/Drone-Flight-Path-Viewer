import { AppError } from "@/lib/errors/app-error";
import type { VideoMetadata } from "@/types/video";

interface FfprobeStream {
  index?: number;
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  pix_fmt?: string;
  bits_per_raw_sample?: string | number;
  width?: number;
  height?: number;
  coded_width?: number;
  coded_height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  duration?: string;
  start_time?: string;
  nb_frames?: string;
  color_primaries?: string;
  color_transfer?: string;
  color_space?: string;
  sample_rate?: string;
  channels?: number;
  disposition?: { attached_pic?: number };
  side_data_list?: Array<{ rotation?: number }>;
  tags?: { rotate?: string };
}

interface FfprobeJson {
  format?: { format_name?: string; duration?: string };
  streams?: FfprobeStream[];
}

function parseRational(value: string | undefined): { num: number; den: number } | null {
  if (typeof value !== "string") return null;
  const m = /^(-?\d+)\/(-?\d+)$/.exec(value.trim());
  if (!m) return null;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return { num, den };
}

function normalizeRotation(deg: number): 0 | 90 | 180 | 270 {
  const normalized = ((Math.round(deg) % 360) + 360) % 360;
  return normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0;
}

function extractRotation(stream: FfprobeStream): 0 | 90 | 180 | 270 {
  for (const entry of stream.side_data_list ?? []) {
    if (typeof entry.rotation === "number" && Number.isFinite(entry.rotation)) return normalizeRotation(entry.rotation);
  }
  const tagRotate = stream.tags?.rotate;
  if (tagRotate !== undefined) {
    const n = Number(tagRotate);
    if (Number.isFinite(n)) return normalizeRotation(n);
  }
  return 0;
}

function toFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractBitDepth(stream: FfprobeStream): 8 | 10 | 12 | null {
  const raw = toFiniteNumber(stream.bits_per_raw_sample);
  if (raw === 8 || raw === 10 || raw === 12) return raw;
  const pixFmt = stream.pix_fmt ?? "";
  if (pixFmt.includes("p12")) return 12;
  if (pixFmt.includes("p10")) return 10;
  return pixFmt ? 8 : null;
}

/** Throws AppError("VIDEO_UNREADABLE") when the file has no usable video stream. sizeBytes comes from the caller's own stat, not ffprobe's format.size. */
export function parseFfprobeJson(json: unknown, sizeBytes: number): VideoMetadata {
  const data = json as FfprobeJson;
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const videoStream = streams.find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1);
  if (!videoStream || !videoStream.width || !videoStream.height) {
    throw new AppError("VIDEO_UNREADABLE");
  }

  let fps = parseRational(videoStream.avg_frame_rate);
  if (!fps || fps.num === 0) fps = parseRational(videoStream.r_frame_rate);
  if (!fps || fps.den === 0) throw new AppError("VIDEO_UNREADABLE");
  const fpsValue = fps.num / fps.den;

  const rFps = parseRational(videoStream.r_frame_rate);
  const rFpsValue = rFps && rFps.den !== 0 ? rFps.num / rFps.den : fpsValue;
  const isVfr = rFpsValue !== 0 && Math.abs(fpsValue - rFpsValue) / rFpsValue > 0.01;

  const rotation = extractRotation(videoStream);
  const rawWidth = videoStream.width;
  const rawHeight = videoStream.height;
  const codedWidth = videoStream.coded_width ?? rawWidth;
  const codedHeight = videoStream.coded_height ?? rawHeight;
  const swapped = rotation === 90 || rotation === 270;
  const width = swapped ? rawHeight : rawWidth;
  const height = swapped ? rawWidth : rawHeight;

  const containerDurationSec = toFiniteNumber(data.format?.duration);
  const streamDurationSec = toFiniteNumber(videoStream.duration);
  const durationSec = streamDurationSec ?? containerDurationSec;
  if (durationSec === null) throw new AppError("VIDEO_UNREADABLE");

  const audioStream = streams.find((s) => s.codec_type === "audio");

  return {
    container: data.format?.format_name ?? "unknown",
    sizeBytes,
    containerDurationSec,
    video: {
      codec: videoStream.codec_name ?? "unknown",
      profile: videoStream.profile ?? null,
      pixelFormat: videoStream.pix_fmt ?? null,
      bitDepth: extractBitDepth(videoStream),
      codedWidth,
      codedHeight,
      rotation,
      width,
      height,
      fps: { num: fps.num, den: fps.den, value: fpsValue },
      avgFrameRate: videoStream.avg_frame_rate ?? "",
      rFrameRate: videoStream.r_frame_rate ?? "",
      isVfr,
      durationSec,
      startTimeSec: toFiniteNumber(videoStream.start_time) ?? 0,
      frameCount: (() => {
        const n = toFiniteNumber(videoStream.nb_frames);
        return n && n > 0 ? n : null;
      })(),
      colorPrimaries: videoStream.color_primaries ?? null,
      colorTransfer: videoStream.color_transfer ?? null,
      colorSpace: videoStream.color_space ?? null,
    },
    audio: audioStream
      ? {
          codec: audioStream.codec_name ?? "unknown",
          sampleRate: toFiniteNumber(audioStream.sample_rate),
          channels: typeof audioStream.channels === "number" ? audioStream.channels : null,
          durationSec: toFiniteNumber(audioStream.duration),
        }
      : null,
    dataStreamCount: streams.filter((s) => s.codec_type === "data").length,
  };
}
