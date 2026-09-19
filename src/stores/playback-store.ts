import { createStore, useStore } from "zustand";
import { useContext, createContext, useState } from "react";
import type { TickReason } from "@/components/video/useVideoClock";
import type { DisplayValues } from "@/lib/overlay/frame-state";

const PUBLISH_THROTTLE_MS = 100;

export interface PlaybackState {
  videoTime: number;
  display: DisplayValues | null;
  reason: TickReason | null;
  publish(videoTime: number, display: DisplayValues, reason: TickReason): void;
}

export type PlaybackStoreApi = ReturnType<typeof createPlaybackStore>;

/** ≥100 ms throttle for "frame" ticks, immediate for seek/pause/load. One store per mounted editor. */
export function createPlaybackStore() {
  let lastPublishMs = 0;
  return createStore<PlaybackState>((set) => ({
    videoTime: 0,
    display: null,
    reason: null,
    publish(videoTime, display, reason) {
      const now = performance.now();
      if (reason === "frame" && now - lastPublishMs < PUBLISH_THROTTLE_MS) return;
      lastPublishMs = now;
      set({ videoTime, display, reason });
    },
  }));
}

export const PlaybackStoreContext = createContext<PlaybackStoreApi | null>(null);

export function usePlaybackStore<T>(selector: (state: PlaybackState) => T): T {
  const store = useContext(PlaybackStoreContext);
  if (!store) throw new Error("usePlaybackStore must be used within a PlaybackStoreContext provider");
  return useStore(store, selector);
}

export function usePlaybackStoreRef(): PlaybackStoreApi {
  const [store] = useState(createPlaybackStore);
  return store;
}
