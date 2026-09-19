import { describe, expect, it } from "vitest";
import { buildAtlasLayout } from "@/lib/overlay/atlas";
import type { OverlayElement } from "@/lib/overlay/model";

const FRAME = { width: 1920, height: 1080 };

function mkPanel(overrides: Partial<OverlayElement> = {}): OverlayElement {
  return {
    id: "telemetryPanel",
    type: "telemetryPanel",
    x: 0.025,
    y: 0.75,
    width: 0.1875,
    height: 0.2,
    opacity: 1,
    visible: true,
    zIndex: 110,
    fields: { altitude: true, speed: true, coordinates: true, heading: false, time: false },
    background: "panel",
    backgroundOpacity: 0.62,
    ...overrides,
  } as OverlayElement;
}

function mkMiniMap(overrides: Partial<OverlayElement> = {}): OverlayElement {
  return {
    id: "miniMap",
    type: "miniMap",
    x: 0.75,
    y: 0.044,
    width: 0.21875,
    height: 0.278,
    opacity: 1,
    visible: true,
    zIndex: 100,
    showPath: true,
    showProgress: true,
    showStartEnd: true,
    showHeading: true,
    showNorthArrow: true,
    showScaleBar: true,
    showMarkers: true,
    basemap: "none",
    paddingRatio: 0.12,
    ...overrides,
  } as OverlayElement;
}

describe("buildAtlasLayout", () => {
  it("returns null when there are no dynamic elements", () => {
    expect(buildAtlasLayout([], FRAME)).toBeNull();
  });

  it("stacks slots vertically in the given order, sizes even, destinations inside the frame", () => {
    const layout = buildAtlasLayout([mkPanel(), mkMiniMap()], FRAME)!;
    expect(layout).not.toBeNull();
    expect(layout.slots).toHaveLength(2);

    const [panelSlot, mapSlot] = layout.slots;
    expect(panelSlot.elementId).toBe("telemetryPanel");
    expect(mapSlot.elementId).toBe("miniMap");

    // stacked vertically: the second slot's srcY starts where the first's height ends
    expect(panelSlot.srcY).toBe(0);
    expect(mapSlot.srcY).toBe(panelSlot.height);

    for (const slot of layout.slots) {
      expect(slot.width % 2).toBe(0);
      expect(slot.height % 2).toBe(0);
      expect(slot.destX).toBeGreaterThanOrEqual(0);
      expect(slot.destY).toBeGreaterThanOrEqual(0);
      expect(slot.destX + slot.width).toBeLessThanOrEqual(FRAME.width);
      expect(slot.destY + slot.height).toBeLessThanOrEqual(FRAME.height);
    }

    expect(layout.width % 2).toBe(0);
    expect(layout.height % 2).toBe(0);
    expect(layout.width).toBe(Math.max(panelSlot.width, mapSlot.width));
    expect(layout.height).toBe(panelSlot.height + mapSlot.height);
  });

  it("clamps a partially off-frame element's destination and shrinks it to fit", () => {
    const offFrame = mkPanel({ x: 0.95, y: 0.95, width: 0.2, height: 0.2 });
    const layout = buildAtlasLayout([offFrame], FRAME)!;
    const slot = layout.slots[0];
    expect(slot.destX + slot.width).toBeLessThanOrEqual(FRAME.width);
    expect(slot.destY + slot.height).toBeLessThanOrEqual(FRAME.height);
  });

  it("throws EXPORT_TOO_MANY_ELEMENTS when the stacked atlas would exceed 16384px", () => {
    const tall = Array.from({ length: 40 }, (_, i) =>
      mkPanel({ id: `vm${i}`, type: "videoMarker" as const, height: 0.5, zIndex: 130 + i } as Partial<OverlayElement>),
    );
    expect(() => buildAtlasLayout(tall, { width: 1920, height: 8640 })).toThrow(/EXPORT_TOO_MANY_ELEMENTS|Too many overlay/);
  });
});
