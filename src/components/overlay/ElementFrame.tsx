"use client";

import { type RefObject, useRef, useState } from "react";
import type { FrameState } from "@/lib/overlay/frame-state";
import { MIN_SIZE_U, snapPosition, unitOf, type Frame } from "@/lib/overlay/layout";
import type { OverlayElement } from "@/lib/overlay/model";
import type { RenderContext } from "@/lib/overlay/render";
import { useEditorStore } from "@/stores/editor-store";
import { ElementCanvas } from "./ElementCanvas";

const RESIZABLE_TYPES = new Set<OverlayElement["type"]>(["telemetryPanel", "miniMap", "logo", "projectLabel", "headingIndicator", "videoMarker", "altitudeGraph", "speedGraph"]);

const TYPE_LABELS: Record<OverlayElement["type"], string> = {
  telemetryPanel: "Telemetry panel",
  miniMap: "Mini map",
  headingIndicator: "Heading indicator",
  grid: "Grid",
  crosshair: "Crosshair",
  projectLabel: "Project label",
  logo: "Logo",
  videoMarker: "Video marker",
  altitudeGraph: "Altitude graph",
  speedGraph: "Speed graph",
};

interface DragTransient {
  x: number;
  y: number;
}

interface ResizeTransient {
  width: number;
  height: number;
}

/** select, drag (with snap + clamp), resize and keyboard nudge. */
export function ElementFrame({
  el,
  frame,
  rc,
  lastFrameState,
  registerDynamic,
  stageRef,
  onDragGuideChange,
}: {
  el: OverlayElement;
  frame: Frame;
  rc: RenderContext;
  lastFrameState: FrameState | null;
  registerDynamic: (id: string, draw: (frameState: FrameState) => void) => () => void;
  stageRef: RefObject<HTMLDivElement | null>;
  onDragGuideChange: (guide: { x: number | null; y: number | null }) => void;
}) {
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const updateElement = useEditorStore((s) => s.updateElement<OverlayElement>);

  const [drag, setDrag] = useState<DragTransient | null>(null);
  const [resize, setResize] = useState<ResizeTransient | null>(null);
  const dragRef = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number; moved: boolean } | null>(null);
  const resizeRef = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number; startW: number; startH: number } | null>(null);

  const interactive = el.type !== "grid";
  const selected = selectedId === el.id;
  const resizable = RESIZABLE_TYPES.has(el.type);
  const logoImage = el.type === "logo" ? (rc.assets.logo as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | null) : null;
  const logoAspect = logoImage ? (logoImage.naturalWidth ?? logoImage.width ?? 1) / (logoImage.naturalHeight ?? logoImage.height ?? 1) : null;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    e.stopPropagation();
    select(el.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startX: el.x, startY: el.y, moved: false };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragRef.current;
    const stage = stageRef.current;
    if (!start || !stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dxN = (e.clientX - start.startClientX) / rect.width;
    const dyN = (e.clientY - start.startClientY) / rect.height;
    let nx = start.startX + dxN;
    let ny = start.startY + dyN;
    let guideX: number | null = null;
    let guideY: number | null = null;
    if (!e.altKey) {
      const snapped = snapPosition(nx, ny, el.width, el.height, frame, { width: rect.width, height: rect.height });
      nx = snapped.x;
      ny = snapped.y;
      if (snapped.snappedX) guideX = nx + el.width / 2;
      if (snapped.snappedY) guideY = ny + el.height / 2;
    }
    nx = Math.min(Math.max(0, nx), 1 - el.width);
    ny = Math.min(Math.max(0, ny), 1 - el.height);
    start.moved = start.moved || Math.abs(e.clientX - start.startClientX) > 1 || Math.abs(e.clientY - start.startClientY) > 1;
    setDrag({ x: nx, y: ny });
    onDragGuideChange({ x: guideX, y: guideY });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragRef.current;
    dragRef.current = null;
    onDragGuideChange({ x: null, y: null });
    if (start && start.moved && drag) {
      updateElement(el.id, { x: drag.x, y: drag.y });
    }
    setDrag(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    select(el.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { startClientX: e.clientX, startClientY: e.clientY, startX: el.x, startY: el.y, startW: el.width, startH: el.height };
  }

  function handleResizePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = resizeRef.current;
    const stage = stageRef.current;
    if (!start || !stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dxN = (e.clientX - start.startClientX) / rect.width;
    const dyN = (e.clientY - start.startClientY) / rect.height;
    const u = unitOf(frame);
    const minW = Math.min(1, (MIN_SIZE_U[el.type].w * u) / frame.width);
    const minH = Math.min(1, (MIN_SIZE_U[el.type].h * u) / frame.height);

    const nw = Math.min(1 - start.startX, Math.max(minW, start.startW + dxN));
    let nh = Math.min(1 - start.startY, Math.max(minH, start.startH + dyN));

    if (el.type === "logo" && logoAspect) {
      nh = Math.min(1 - start.startY, Math.max(minH, (nw * frame.width) / frame.height / logoAspect));
    } else if (e.shiftKey) {
      const pixelAspect = (start.startW * frame.width) / (start.startH * frame.height);
      nh = Math.min(1 - start.startY, Math.max(minH, (nw * frame.width) / frame.height / pixelAspect));
    }

    setResize({ width: nw, height: nh });
  }

  function handleResizePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    resizeRef.current = null;
    if (resize) {
      updateElement(el.id, { width: resize.width, height: resize.height });
    }
    setResize(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const displayX = drag ? drag.x : el.x;
  const displayY = drag ? drag.y : el.y;
  const displayW = resize ? resize.width : el.width;
  const displayH = resize ? resize.height : el.height;
  const displayEl = resize ? ({ ...el, width: resize.width, height: resize.height } as OverlayElement) : el;

  return (
    <div
      className={`absolute ${interactive ? "cursor-move" : ""}`}
      style={{
        left: `${displayX * 100}%`,
        top: `${displayY * 100}%`,
        width: `${displayW * 100}%`,
        height: `${displayH * 100}%`,
        zIndex: el.zIndex,
        pointerEvents: interactive ? undefined : "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <ElementCanvas el={displayEl} frame={frame} rc={rc} lastFrameState={lastFrameState} registerDynamic={registerDynamic} />
      {selected && interactive && (
        <>
          <div className="pointer-events-none absolute inset-0 border border-primary" />
          <div className="pointer-events-none absolute -top-5 left-0 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-primary-foreground">
            {TYPE_LABELS[el.type] ?? el.type}
          </div>
        </>
      )}
      {selected && resizable && (
        <div
          className="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-background bg-primary"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
        />
      )}
    </div>
  );
}
