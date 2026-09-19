"use client";

import { forwardRef, useEffect, useRef, useState, type RefObject } from "react";
import { TriangleAlert } from "lucide-react";
import { OverlayStage, type OverlayStageHandle } from "@/components/overlay/OverlayStage";
import type { RenderContext } from "@/lib/overlay/render";
import type { VideoMetadata } from "@/types/video";

export interface ContentRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface VideoStageProps {
  projectId: string;
  videoMetadata: VideoMetadata;
  onDecodeError?: () => void;
  overlay?: { rc: RenderContext; stageRef: RefObject<OverlayStageHandle | null> };
  /** When set, clicking anywhere in the video frame calls this with a normalized position + the current video time ("+ Video marker" mode). */
  onVideoClick?: (at: { x: number; y: number; time: number }) => void;
}

/** video plus the overlay stage, sharing one content rect. */
export const VideoStage = forwardRef<HTMLVideoElement, VideoStageProps>(function VideoStage(
  { projectId, videoMetadata, onDecodeError, overlay, onVideoClick },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<ContentRect>({ left: 0, top: 0, width: 0, height: 0 });
  const [decodeError, setDecodeError] = useState(false);
  const vw = videoMetadata.video.width;
  const vh = videoMetadata.video.height;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const s = Math.min(cw / vw, ch / vh);
      setRect({ left: (cw - vw * s) / 2, top: (ch - vh * s) / 2, width: vw * s, height: vh * s });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [vw, vh]);

  const style = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-[#07080A] ${onVideoClick ? "cursor-crosshair" : ""}`}
      onClick={(e) => {
        if (!onVideoClick) return;
        const container = containerRef.current;
        const video = container?.querySelector("video");
        if (!container || !video || rect.width === 0) return;
        const bounds = container.getBoundingClientRect();
        const clickX = e.clientX - bounds.left - rect.left;
        const clickY = e.clientY - bounds.top - rect.top;
        if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) return;
        onVideoClick({ x: clickX / rect.width, y: clickY / rect.height, time: video.currentTime });
      }}
    >
      <video
        ref={ref}
        style={style}
        className="absolute"
        playsInline
        preload="auto"
        src={`/api/projects/${projectId}/video`}
        onError={(e) => {
          // only MEDIA_ERR_DECODE (3) / MEDIA_ERR_SRC_NOT_SUPPORTED (4) are codec problems.
          const code = e.currentTarget.error?.code;
          if (code === 3 || code === 4) {
            setDecodeError(true);
            onDecodeError?.();
          }
        }}
      />
      {overlay && (
        <div style={style} className="absolute">
          <OverlayStage ref={overlay.stageRef} frame={{ width: vw, height: vh }} rc={overlay.rc} className="relative h-full w-full" />
        </div>
      )}
      {decodeError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 p-6 text-center">
          <TriangleAlert className="size-8 text-destructive" aria-hidden="true" />
          <p className="max-w-sm text-sm text-foreground">
            This browser can&apos;t decode this video&apos;s codec (HEVC/H.265). Use Chrome or Safari on macOS, or re-encode the file to H.264.
          </p>
        </div>
      )}
    </div>
  );
});
