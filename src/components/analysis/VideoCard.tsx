import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/lib/format/bytes";
import { formatDuration } from "@/lib/format/duration";
import type { VideoMetadata } from "@/types/video";

const CODEC_NAMES: Record<string, string> = { h264: "H.264", hevc: "HEVC", vp9: "VP9", av1: "AV1", mpeg4: "MPEG-4" };
const TRANSFER_LABELS: Record<string, string> = { "arib-std-b67": "HLG", smpte2084: "PQ/HDR10" };

function formatFps(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded} FPS` : `${rounded.toFixed(2)} FPS`;
}

function formatCodecLabel(video: VideoMetadata["video"]): string {
  const parts = [CODEC_NAMES[video.codec] ?? video.codec.toUpperCase()];
  if (video.bitDepth && video.bitDepth > 8) parts.push(`${video.bitDepth}-bit`);
  if (video.colorTransfer && TRANSFER_LABELS[video.colorTransfer]) parts.push(TRANSFER_LABELS[video.colorTransfer]);
  return parts.join(" · ");
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}

export function VideoCard({ metadata }: { metadata: VideoMetadata }) {
  const { video, audio } = metadata;
  const showToneMappingNote = (video.bitDepth ?? 8) > 8 || Boolean(video.colorTransfer && TRANSFER_LABELS[video.colorTransfer]);
  const audioLabel = audio
    ? `${CODEC_NAMES[audio.codec] ?? audio.codec.toUpperCase()}${audio.sampleRate ? ` ${Math.round(audio.sampleRate / 1000)} kHz` : ""}`
    : "No audio track";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-sm tabular-nums sm:grid-cols-3">
        <Field label="Resolution" value={`${video.width} × ${video.height}`} />
        <Field label="Frame rate" value={formatFps(video.fps.value)} />
        <Field label="Duration" value={formatDuration(video.durationSec)} />
        <Field label="Codec" value={formatCodecLabel(video)} />
        <Field label="Audio" value={audioLabel} />
        <Field label="Size" value={formatBytes(metadata.sizeBytes)} />
      </CardContent>
      {showToneMappingNote && (
        <CardContent className="pt-0 text-xs text-muted-foreground">Export is 8-bit H.264 without LUT/tone mapping.</CardContent>
      )}
    </Card>
  );
}
