"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

export type TickReason = "frame" | "seek" | "pause" | "load";

/** Drives every overlay/map update from the video's own clock — no interval timers. */
export function useVideoClock(videoRef: RefObject<HTMLVideoElement | null>, onTick: (videoTime: number, reason: TickReason) => void): void {
  const tick = useEffectEvent(onTick);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let handle = 0;
    let raf = 0;
    const hasRvfc = "requestVideoFrameCallback" in HTMLVideoElement.prototype;
    const onFrame: VideoFrameRequestCallback = (_now, meta) => {
      tick(meta.mediaTime, "frame");
      handle = video.requestVideoFrameCallback(onFrame);
    };
    const rafLoop = () => {
      tick(video.currentTime, "frame");
      if (!video.paused) raf = requestAnimationFrame(rafLoop);
    };
    const onSeeked = () => tick(video.currentTime, "seek");
    const onPause = () => tick(video.currentTime, "pause");
    const onLoaded = () => tick(video.currentTime, "load");
    const onPlay = () => {
      if (!hasRvfc) raf = requestAnimationFrame(rafLoop);
    };
    if (hasRvfc) handle = video.requestVideoFrameCallback(onFrame);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("pause", onPause);
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("play", onPlay);
    return () => {
      if (hasRvfc) video.cancelVideoFrameCallback(handle);
      cancelAnimationFrame(raf);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("play", onPlay);
    };
  }, [videoRef]);
}
