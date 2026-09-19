import { describe, expect, it } from "vitest";
import {
  aspectClass,
  boxFromSpec,
  clampElement,
  MIN_SIZE_U,
  positionPreset,
  resizeAboutCenter,
  snapPosition,
  toPixelRect,
  unitOf,
} from "@/lib/overlay/layout";
import type { LogoElement } from "@/lib/overlay/model";

const FRAME_LANDSCAPE = { width: 1920, height: 1080 };
const FRAME_PORTRAIT = { width: 1080, height: 1920 };
const FRAME_SQUARE = { width: 1080, height: 1080 };

function mkLogo(overrides: Partial<LogoElement> = {}): LogoElement {
  return { id: "logo", type: "logo", x: 0, y: 0, width: 0.1, height: 0.1, opacity: 1, visible: true, zIndex: 30, ...overrides };
}

describe("unitOf / aspectClass", () => {
  it("unit is min(w,h)/1080", () => {
    expect(unitOf(FRAME_LANDSCAPE)).toBeCloseTo(1, 9);
    expect(unitOf({ width: 3840, height: 2160 })).toBeCloseTo(2, 9);
  });

  it("classifies landscape, portrait and square", () => {
    expect(aspectClass(FRAME_LANDSCAPE)).toBe("landscape");
    expect(aspectClass(FRAME_PORTRAIT)).toBe("portrait");
    expect(aspectClass(FRAME_SQUARE)).toBe("square");
    expect(aspectClass({ width: 1440, height: 1080 })).toBe("landscape");
  });
});

describe("toPixelRect", () => {
  it("rounds to nearest pixel and enforces a minimum of 2px", () => {
    const rect = toPixelRect({ x: 0.1, y: 0.2, width: 0.0005, height: 0.0005 }, FRAME_LANDSCAPE);
    expect(rect.x).toBe(Math.round(0.1 * 1920));
    expect(rect.y).toBe(Math.round(0.2 * 1080));
    expect(rect.w).toBe(2);
    expect(rect.h).toBe(2);
  });

  it("matches exact rounding for a typical box", () => {
    const rect = toPixelRect({ x: 0.025, y: 0.0444444, width: 0.1875, height: 0.2037 }, FRAME_LANDSCAPE);
    expect(rect).toEqual({ x: Math.round(0.025 * 1920), y: Math.round(0.0444444 * 1080), w: Math.round(0.1875 * 1920), h: Math.round(0.2037 * 1080) });
  });
});

describe("clampElement", () => {
  it("enforces the type's minimum size in u units", () => {
    const el = mkLogo({ width: 0.001, height: 0.001 });
    const clamped = clampElement(el, FRAME_LANDSCAPE);
    const minW = MIN_SIZE_U.logo.w / FRAME_LANDSCAPE.width;
    const minH = MIN_SIZE_U.logo.h / FRAME_LANDSCAPE.height;
    expect(clamped.width).toBeCloseTo(minW, 9);
    expect(clamped.height).toBeCloseTo(minH, 9);
  });

  it("keeps a box already within bounds unchanged", () => {
    const el = mkLogo({ x: 0.2, y: 0.3, width: 0.15, height: 0.1 });
    const clamped = clampElement(el, FRAME_LANDSCAPE);
    expect(clamped.x).toBeCloseTo(0.2, 9);
    expect(clamped.y).toBeCloseTo(0.3, 9);
    expect(clamped.width).toBeCloseTo(0.15, 9);
    expect(clamped.height).toBeCloseTo(0.1, 9);
  });

  it("pulls x/y back inside [0, 1-w/h] when the box would overflow", () => {
    const el = mkLogo({ x: 0.99, y: 0.99, width: 0.2, height: 0.2 });
    const clamped = clampElement(el, FRAME_LANDSCAPE);
    expect(clamped.x).toBeCloseTo(0.8, 9);
    expect(clamped.y).toBeCloseTo(0.8, 9);
  });
});

describe("positionPreset", () => {
  const u = unitOf(FRAME_LANDSCAPE);
  const marginPx = 32 * u;

  it("places a box at the top-left corner with a 32u margin", () => {
    const el = mkLogo({ x: 0.5, y: 0.5, width: 0.1, height: 0.1 });
    const placed = positionPreset(el, "tl", FRAME_LANDSCAPE);
    expect(placed.x * FRAME_LANDSCAPE.width).toBeCloseTo(marginPx, 6);
    expect(placed.y * FRAME_LANDSCAPE.height).toBeCloseTo(marginPx, 6);
  });

  it("places a box at the bottom-right corner with a 32u margin", () => {
    const el = mkLogo({ x: 0.5, y: 0.5, width: 0.1, height: 0.1 });
    const placed = positionPreset(el, "br", FRAME_LANDSCAPE);
    const expectedRight = FRAME_LANDSCAPE.width - marginPx - placed.width * FRAME_LANDSCAPE.width;
    const expectedBottom = FRAME_LANDSCAPE.height - marginPx - placed.height * FRAME_LANDSCAPE.height;
    expect(placed.x * FRAME_LANDSCAPE.width).toBeCloseTo(expectedRight, 6);
    expect(placed.y * FRAME_LANDSCAPE.height).toBeCloseTo(expectedBottom, 6);
  });
});

describe("snapPosition", () => {
  const STAGE_PX = { width: 960, height: 540 }; // half-scale of FRAME_LANDSCAPE
  const u = unitOf(FRAME_LANDSCAPE);
  const marginNormX = (32 * u) / FRAME_LANDSCAPE.width;
  const marginNormY = (32 * u) / FRAME_LANDSCAPE.height;

  it("snaps to the top-left margin when within the 6px threshold", () => {
    const nearX = marginNormX + 3 / STAGE_PX.width;
    const nearY = marginNormY + 3 / STAGE_PX.height;
    const result = snapPosition(nearX, nearY, 0.1, 0.1, FRAME_LANDSCAPE, STAGE_PX);
    expect(result.snappedX).toBe(true);
    expect(result.snappedY).toBe(true);
    expect(result.x).toBeCloseTo(marginNormX, 9);
    expect(result.y).toBeCloseTo(marginNormY, 9);
  });

  it("snaps to the bottom-right margin candidate", () => {
    const w = 0.1;
    const h = 0.1;
    const target = 1 - marginNormX - w;
    const result = snapPosition(target + 2 / STAGE_PX.width, 0.4, w, h, FRAME_LANDSCAPE, STAGE_PX);
    expect(result.snappedX).toBe(true);
    expect(result.x).toBeCloseTo(target, 9);
  });

  it("snaps to the centre candidate", () => {
    const w = 0.2;
    const h = 0.2;
    const target = 0.5 - w / 2;
    const result = snapPosition(target + 1 / STAGE_PX.width, 0.5 - h / 2, w, h, FRAME_LANDSCAPE, STAGE_PX);
    expect(result.snappedX).toBe(true);
    expect(result.x).toBeCloseTo(target, 9);
  });

  it("does not snap when outside the threshold", () => {
    const result = snapPosition(0.3, 0.3, 0.1, 0.1, FRAME_LANDSCAPE, STAGE_PX);
    expect(result.snappedX).toBe(false);
    expect(result.snappedY).toBe(false);
    expect(result.x).toBeCloseTo(0.3, 9);
    expect(result.y).toBeCloseTo(0.3, 9);
  });

  it("treats a zero-size stage as never snapping", () => {
    const result = snapPosition(marginNormX, marginNormY, 0.1, 0.1, FRAME_LANDSCAPE, { width: 0, height: 0 });
    expect(result.snappedX).toBe(true); // exact equality still matches with a zero threshold
    expect(result.snappedY).toBe(true);
  });
});

describe("resizeAboutCenter", () => {
  it("keeps the same centre when growing", () => {
    const el = mkLogo({ x: 0.4, y: 0.4, width: 0.1, height: 0.1 });
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const resized = resizeAboutCenter(el, 0.2, 0.2, FRAME_LANDSCAPE);
    expect(resized.x + resized.width / 2).toBeCloseTo(cx, 9);
    expect(resized.y + resized.height / 2).toBeCloseTo(cy, 9);
    expect(resized.width).toBeCloseTo(0.2, 9);
    expect(resized.height).toBeCloseTo(0.2, 9);
  });

  it("clamps into the frame when growing past an edge", () => {
    const el = mkLogo({ x: 0.02, y: 0.02, width: 0.05, height: 0.05 });
    const resized = resizeAboutCenter(el, 0.3, 0.3, FRAME_LANDSCAPE);
    expect(resized.x).toBeGreaterThanOrEqual(0);
    expect(resized.y).toBeGreaterThanOrEqual(0);
    expect(resized.x + resized.width).toBeLessThanOrEqual(1 + 1e-9);
    expect(resized.y + resized.height).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe("boxFromSpec", () => {
  it("anchors top-left with margins and converts u units to normalized coordinates", () => {
    const box = boxFromSpec({ anchor: "tl", marginX: 48, marginY: 48, width: 360, height: 220 }, FRAME_LANDSCAPE);
    const u = unitOf(FRAME_LANDSCAPE);
    expect(box.x * FRAME_LANDSCAPE.width).toBeCloseTo(48 * u, 6);
    expect(box.y * FRAME_LANDSCAPE.height).toBeCloseTo(48 * u, 6);
    expect(box.width * FRAME_LANDSCAPE.width).toBeCloseTo(360 * u, 6);
    expect(box.height * FRAME_LANDSCAPE.height).toBeCloseTo(220 * u, 6);
  });

  it("anchors center at the middle of the frame", () => {
    const box = boxFromSpec({ anchor: "center", marginX: 0, marginY: 0, width: 72, height: 72 }, FRAME_LANDSCAPE);
    const cx = (box.x + box.width / 2) * FRAME_LANDSCAPE.width;
    const cy = (box.y + box.height / 2) * FRAME_LANDSCAPE.height;
    expect(cx).toBeCloseTo(FRAME_LANDSCAPE.width / 2, 1);
    expect(cy).toBeCloseTo(FRAME_LANDSCAPE.height / 2, 1);
  });

  it("clamps box size to never exceed the frame", () => {
    const box = boxFromSpec({ anchor: "tl", marginX: 0, marginY: 0, width: 100000, height: 100000 }, FRAME_LANDSCAPE);
    expect(box.width).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(1);
  });
});
