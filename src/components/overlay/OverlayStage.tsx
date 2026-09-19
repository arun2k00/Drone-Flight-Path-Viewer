"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadOverlayFonts } from "@/lib/overlay/assets.browser";
import type { FrameState } from "@/lib/overlay/frame-state";
import type { Frame } from "@/lib/overlay/layout";
import type { RenderContext } from "@/lib/overlay/render";
import { ElementFrame } from "./ElementFrame";

export interface OverlayStageHandle {
  /** Called from the video clock's onTick; forwards the frame to every dynamic element's canvas. */
  drawFrame(frameState: FrameState): void;
}

export interface OverlayStageProps {
  frame: Frame;
  rc: RenderContext;
  className?: string;
}

export const OverlayStage = forwardRef<OverlayStageHandle, OverlayStageProps>(function OverlayStage({ frame, rc, className }, ref) {
  const [fontsReady, setFontsReady] = useState(false);
  const registryRef = useRef(new Map<string, (frameState: FrameState) => void>());
  const lastFrameRef = useRef<FrameState | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [dragGuide, setDragGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  useEffect(() => {
    let cancelled = false;
    void loadOverlayFonts().then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const registerDynamic = useCallback((id: string, draw: (frameState: FrameState) => void) => {
    registryRef.current.set(id, draw);
    return () => {
      registryRef.current.delete(id);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    drawFrame(frameState) {
      lastFrameRef.current = frameState;
      registryRef.current.forEach((draw) => draw(frameState));
    },
  }));

  if (!fontsReady) return null;

  const visible = [...rc.config.elements].filter((el) => el.visible).sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div ref={stageRef} className={className}>
      {visible.map((el) => (
        <ElementFrame
          key={el.id}
          el={el}
          frame={frame}
          rc={rc}
          lastFrameState={lastFrameRef.current}
          registerDynamic={registerDynamic}
          stageRef={stageRef}
          onDragGuideChange={setDragGuide}
        />
      ))}
      {dragGuide.x !== null && (
        <div className="pointer-events-none absolute top-0 h-full border-l border-dashed border-primary" style={{ left: `${dragGuide.x * 100}%`, zIndex: 1000 }} />
      )}
      {dragGuide.y !== null && (
        <div className="pointer-events-none absolute left-0 w-full border-t border-dashed border-primary" style={{ top: `${dragGuide.y * 100}%`, zIndex: 1000 }} />
      )}
    </div>
  );
});
