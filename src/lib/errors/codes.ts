export type ErrorCode =
  | "VALIDATION_FAILED"
  | "PROJECT_NOT_FOUND"
  | "FILE_NOT_FOUND"
  | "FILE_EMPTY"
  | "VIDEO_UNSUPPORTED_TYPE"
  | "VIDEO_TOO_LARGE"
  | "VIDEO_INVALID_CONTAINER"
  | "VIDEO_UNREADABLE"
  | "VIDEO_CODEC_UNSUPPORTED"
  | "SRT_UNSUPPORTED_TYPE"
  | "SRT_TOO_LARGE"
  | "SRT_INVALID"
  | "TELEMETRY_NO_RECOGNIZED_FIELDS"
  | "TELEMETRY_NO_GPS"
  | "GPS_INCOMPLETE"
  | "SYNC_NO_OVERLAP"
  | "SYNC_DURATION_MISMATCH"
  | "LOGO_INVALID"
  | "LOGO_TOO_LARGE"
  | "UPLOAD_NOT_FOUND"
  | "UPLOAD_OFFSET_MISMATCH"
  | "UPLOAD_CHUNK_TOO_LARGE"
  | "UPLOAD_BUSY"
  | "UPLOAD_INCOMPLETE"
  | "ANALYSIS_MISSING_FILES"
  | "ANALYSIS_REQUIRED"
  | "RESOLUTION_UNAVAILABLE"
  | "JOB_ALREADY_RUNNING"
  | "JOB_NOT_FOUND"
  | "JOB_NOT_CANCELLABLE"
  | "EXPORT_NOT_READY"
  | "EXPORT_FFMPEG_FAILED"
  | "FFMPEG_NOT_FOUND"
  | "EXPORT_DISK_FULL"
  | "EXPORT_RENDER_FAILED"
  | "EXPORT_VERIFY_FAILED"
  | "EXPORT_INTERRUPTED"
  | "EXPORT_CANCELLED"
  | "EXPORT_TOO_MANY_ELEMENTS"
  | "BASEMAP_NOT_CONFIGURED"
  | "BASEMAP_UNAVAILABLE"
  | "LOW_DISK_SPACE"
  | "INTERNAL_ERROR"
  | "GPS_TUPLE_ORDER_ASSUMED"
  | "SPEED_DERIVED_FROM_GPS"
  | "HEADING_UNAVAILABLE"
  | "SYNC_LOW_COVERAGE"
  | "TELEMETRY_GAPS"
  | "SYNC_PER_FRAME"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "SHARE_NOT_FOUND";

export interface ErrorCatalogEntry {
  /** HTTP status for codes thrown as AppError from a route. 0 = never thrown from a route (client-only or warning-only). */
  status: number;
  /** May contain "{placeholder}" tokens, filled from AppError details / warning formatting. */
  message: string;
}

/** Fills a catalogue message's "{placeholder}" tokens from details — used by AppError and by WarningDto builders (e.g. telemetry/summary.ts). */
export function formatCatalogMessage(code: ErrorCode, details?: Record<string, unknown>): string {
  const template = ERROR_CATALOG[code].message;
  if (!details) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (details[key] === undefined ? match : String(details[key])));
}

/** Source of truth for every error and warning code. */
export const ERROR_CATALOG: Record<ErrorCode, ErrorCatalogEntry> = {
  VALIDATION_FAILED: { status: 400, message: "Some fields are invalid." },
  PROJECT_NOT_FOUND: { status: 404, message: "Project not found." },
  FILE_NOT_FOUND: { status: 404, message: "File not found." },
  FILE_EMPTY: { status: 400, message: "The selected file is empty." },
  VIDEO_UNSUPPORTED_TYPE: { status: 400, message: "Unsupported video format. Upload an MP4, MOV or M4V file." },
  VIDEO_TOO_LARGE: { status: 413, message: "This video is larger than the {limit} upload limit." },
  VIDEO_INVALID_CONTAINER: { status: 400, message: "This file doesn't look like an MP4 or MOV video." },
  VIDEO_UNREADABLE: { status: 422, message: "Unable to read video file." },
  VIDEO_CODEC_UNSUPPORTED: {
    status: 0,
    message:
      "This browser can't decode this video's codec (HEVC/H.265). Use Chrome or Safari on macOS, or re-encode the file to H.264. Export is not affected.",
  },
  SRT_UNSUPPORTED_TYPE: { status: 400, message: "Telemetry must be an .SRT file." },
  SRT_TOO_LARGE: { status: 413, message: "This SRT file is larger than the {limit} upload limit." },
  SRT_INVALID: { status: 422, message: "This file is not a valid SRT subtitle file." },
  TELEMETRY_NO_RECOGNIZED_FIELDS: { status: 422, message: "The SRT file does not contain recognizable GPS telemetry." },
  TELEMETRY_NO_GPS: { status: 422, message: "GPS data is unavailable in this SRT file." },
  GPS_INCOMPLETE: { status: 0, message: "GPS data is incomplete (available for {pct}% of samples)." },
  SYNC_NO_OVERLAP: { status: 0, message: "Video and telemetry timestamps do not appear to overlap." },
  SYNC_DURATION_MISMATCH: { status: 0, message: "Telemetry duration differs from video duration." },
  LOGO_INVALID: { status: 400, message: "Logo must be a PNG, SVG or WEBP image." },
  LOGO_TOO_LARGE: { status: 413, message: "This logo is larger than the {limit} upload limit." },
  UPLOAD_NOT_FOUND: { status: 404, message: "Upload session not found. Start the upload again." },
  UPLOAD_OFFSET_MISMATCH: { status: 409, message: "Upload position changed. Resuming…" },
  UPLOAD_CHUNK_TOO_LARGE: { status: 413, message: "Upload chunk is too large." },
  UPLOAD_BUSY: { status: 409, message: "This upload is already in progress in another request." },
  UPLOAD_INCOMPLETE: { status: 409, message: "The upload is incomplete." },
  ANALYSIS_MISSING_FILES: { status: 409, message: "Upload both the video and its SRT telemetry before analyzing." },
  ANALYSIS_REQUIRED: { status: 409, message: "Analyze the project first." },
  RESOLUTION_UNAVAILABLE: {
    status: 400,
    message: "That resolution isn't available because the source video is smaller (no upscaling).",
  },
  JOB_ALREADY_RUNNING: { status: 409, message: "An export is already running for this project." },
  JOB_NOT_FOUND: { status: 404, message: "Export not found." },
  JOB_NOT_CANCELLABLE: { status: 409, message: "This export has already finished." },
  EXPORT_NOT_READY: { status: 409, message: "The export isn't finished yet." },
  EXPORT_FFMPEG_FAILED: { status: 500, message: "FFmpeg export failed." },
  FFMPEG_NOT_FOUND: { status: 500, message: "FFmpeg is not installed or FFMPEG_PATH is incorrect." },
  EXPORT_DISK_FULL: { status: 507, message: "Not enough free disk space to finish the export." },
  EXPORT_RENDER_FAILED: { status: 500, message: "The overlay could not be rendered." },
  EXPORT_VERIFY_FAILED: { status: 500, message: "The exported file could not be verified." },
  EXPORT_INTERRUPTED: { status: 500, message: "The export was interrupted because the server restarted." },
  EXPORT_CANCELLED: { status: 200, message: "Export cancelled." },
  EXPORT_TOO_MANY_ELEMENTS: { status: 400, message: "Too many overlay elements to export. Remove some video markers." },
  BASEMAP_NOT_CONFIGURED: { status: 404, message: "No tile provider is configured for burned-in maps." },
  BASEMAP_UNAVAILABLE: {
    status: 502,
    message: "Map tiles could not be loaded; the mini map was rendered without a basemap.",
  },
  LOW_DISK_SPACE: { status: 0, message: "Free disk space is low; the export may fail." },
  INTERNAL_ERROR: { status: 500, message: "Something went wrong. Check the server logs for details." },
  GPS_TUPLE_ORDER_ASSUMED: {
    status: 0,
    message: "GPS coordinate order couldn't be detected; longitude, latitude was assumed. Check that the flight path appears in the right place.",
  },
  SPEED_DERIVED_FROM_GPS: {
    status: 0,
    message: "This SRT has no speed field, so speed is derived from GPS positions.",
  },
  HEADING_UNAVAILABLE: {
    status: 0,
    message: "This SRT has no heading or yaw field, so heading will show as unavailable.",
  },
  SYNC_LOW_COVERAGE: { status: 0, message: "Telemetry covers only {pct}% of the video." },
  TELEMETRY_GAPS: { status: 0, message: "Telemetry has {n} gap(s); the longest is {x} s." },
  SYNC_PER_FRAME: { status: 0, message: "One telemetry record per video frame." },
  UNAUTHORIZED: { status: 401, message: "Please log in to continue." },
  FORBIDDEN: { status: 403, message: "You don't have access to this." },
  RATE_LIMITED: { status: 429, message: "Too many attempts. Try again in a few minutes." },
  SHARE_NOT_FOUND: { status: 404, message: "This link has expired or was revoked." },
};
