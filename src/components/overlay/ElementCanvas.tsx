"use client";

import { useEffect, useRef } from "react";
import { isDynamic } from "@/lib/overlay/classify";
import type { FrameState } from "@/lib/overlay/frame-state";
import type { Frame } from "@/lib/overlay/layout";
import type { OverlayElement } from "@/lib/overlay/model";
import { drawElement, type RenderContext } from "@/lib/overlay/render";

/**
 * The backing store tracks the element's actual on-screen CSS size
 * (via ResizeObserver, not `frame.width` — a 4K export frame previewed at a small drawer size must
 * not allocate a 4K-sized canvas). `drawElement` itself always receives export-pixel geometry
 * (el.width*frame.width square); the draw transform maps that onto whatever backing size the
 * canvas currently has, so preview and export produce identical layouts at different scales.
 */
export function ElementCanvas({
  el,
  frame,
  rc,
  lastFrameState,
  registerDynamic,
}: {
  el: OverlayElement;
  frame: Frame;
  rc: RenderContext;
  lastFrameState: FrameState | null;
  registerDynamic: (id: string, draw: (frameState: FrameState) => void) => () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrameRef = useRef<FrameState | null>(lastFrameState);
  useEffect(() => {
    lastFrameRef.current = lastFrameState;
  }, [lastFrameState]);

  const draw = (frameState: FrameState | null) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const exportW = el.width * frame.width;
    const exportH = el.height * frame.height;
    ctx.setTransform(canvas.width / exportW, 0, 0, canvas.height / exportH, 0, 0);
    ctx.clearRect(0, 0, exportW, exportH);
    ctx.globalAlpha = el.opacity;
    drawElement(ctx, el, exportW, exportH, rc, frameState);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      draw(lastFrameRef.current);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resize handling only needs to re-attach when the canvas node itself changes.
  }, []);

  useEffect(() => {
    if (!isDynamic(el)) {
      draw(lastFrameState);
      return;
    }
    draw(lastFrameState);
    return registerDynamic(el.id, draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `draw` closes over the latest el/frame/rc each render; only re-subscribe when the element identity, geometry or config changes.
  }, [el, frame.width, frame.height, rc, registerDynamic]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}
