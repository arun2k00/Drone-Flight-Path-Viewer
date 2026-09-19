import { formatCatalogMessage } from "@/lib/errors/codes";
import type { WarningDto } from "@/types/api";
import type { SyncReport, SyncStatus } from "@/types/telemetry";

export interface ComputeSyncReportInput {
  videoDurationSec: number; // video STREAM duration, not container duration
  fps: number;
  videoFrameCount: number | null;
  telemetry: { timeRange: { start: number; end: number }; sampleCount: number };
  cueBounds: { start: Float64Array; end: Float64Array }; // for gap detection
  offsetSec: number;
}

/** srtTime = videoTime − offsetSec, so a positive offset shifts the telemetry window later. */
export function computeSyncReport(input: ComputeSyncReportInput): SyncReport {
  const { videoDurationSec, fps, videoFrameCount, telemetry, cueBounds, offsetSec } = input;
  const telStart = telemetry.timeRange.start + offsetSec;
  const telEnd = telemetry.timeRange.end + offsetSec;
  const overlap = Math.max(0, Math.min(videoDurationSec, telEnd) - Math.max(0, telStart));
  const coverage = videoDurationSec > 0 ? overlap / videoDurationSec : 0;
  const startDelta = telStart;
  const endDelta = telEnd - videoDurationSec;
  const tolStart = Math.max(0.25, 2 / fps);
  const tolEnd = Math.max(0.5, 2 / fps);

  let status: SyncStatus;
  if (overlap <= 0) status = "NO_OVERLAP";
  else if (Math.abs(startDelta) <= tolStart && Math.abs(endDelta) <= tolEnd) status = "GOOD";
  else if (coverage >= 0.9) status = "WARNING";
  else status = "MISMATCH";

  let gapCount = 0;
  let longestGapSec = 0;
  for (let i = 0; i < cueBounds.start.length - 1; i++) {
    const gap = cueBounds.start[i + 1] - cueBounds.end[i];
    if (gap > 1.0) {
      gapCount++;
      if (gap > longestGapSec) longestGapSec = gap;
    }
  }

  const recordsPerFrame = videoFrameCount ? telemetry.sampleCount / videoFrameCount : null;

  const messages: WarningDto[] = [];
  if (status === "NO_OVERLAP") {
    messages.push({ code: "SYNC_NO_OVERLAP", message: formatCatalogMessage("SYNC_NO_OVERLAP") });
  }
  if (status === "WARNING" || status === "MISMATCH") {
    let message = formatCatalogMessage("SYNC_DURATION_MISMATCH");
    if (Math.abs(endDelta) > tolEnd) {
      const beforeAfter = endDelta < 0 ? "before" : "after";
      message += ` Telemetry ends ${Math.abs(endDelta).toFixed(1)} s ${beforeAfter} the video.`;
    }
    messages.push({ code: "SYNC_DURATION_MISMATCH", message });
  }
  if (status === "MISMATCH") {
    messages.push({ code: "SYNC_LOW_COVERAGE", message: formatCatalogMessage("SYNC_LOW_COVERAGE", { pct: Math.round(coverage * 100) }) });
  }
  if (gapCount > 0) {
    messages.push({
      code: "TELEMETRY_GAPS",
      message: formatCatalogMessage("TELEMETRY_GAPS", { n: gapCount, x: longestGapSec.toFixed(1) }),
    });
  }
  if (recordsPerFrame !== null && Math.abs(recordsPerFrame - 1) <= 0.02) {
    messages.push({ code: "SYNC_PER_FRAME", message: formatCatalogMessage("SYNC_PER_FRAME") });
  }

  return {
    status,
    videoDurationSec,
    telemetryStartSec: telemetry.timeRange.start,
    telemetryEndSec: telemetry.timeRange.end,
    offsetSec,
    overlapSec: overlap,
    coverage,
    startDeltaSec: startDelta,
    endDeltaSec: endDelta,
    videoFrameCount,
    recordsPerFrame,
    gapCount,
    longestGapSec,
    messages,
  };
}
