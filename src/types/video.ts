/** ffprobe-derived metadata. */
export interface VideoMetadata {
  container: string; // ffprobe format_name
  sizeBytes: number;
  containerDurationSec: number | null; // format.duration
  video: {
    codec: string; // "h264" | "hevc" | …
    profile: string | null;
    pixelFormat: string | null; // "yuv420p", "yuv420p10le"
    bitDepth: 8 | 10 | 12 | null;
    codedWidth: number;
    codedHeight: number;
    rotation: 0 | 90 | 180 | 270;
    width: number; // DISPLAY dimensions (after rotation) = browser videoWidth/Height
    height: number;
    fps: { num: number; den: number; value: number }; // from avg_frame_rate, fallback r_frame_rate
    avgFrameRate: string;
    rFrameRate: string;
    isVfr: boolean; // |avg − r| / r > 0.01
    durationSec: number; // stream duration, fallback container duration
    startTimeSec: number; // stream start_time, 0 when absent
    frameCount: number | null; // nb_frames
    colorPrimaries: string | null;
    colorTransfer: string | null;
    colorSpace: string | null;
  };
  audio: { codec: string; sampleRate: number | null; channels: number | null; durationSec: number | null } | null;
  dataStreamCount: number; // DJI files carry extra data tracks; ignored
}
