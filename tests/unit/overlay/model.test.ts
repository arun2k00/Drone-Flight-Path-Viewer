import { describe, expect, it } from "vitest";
import { overlayConfigSchema } from "@/lib/overlay/model";
import { instantiateTemplate } from "@/lib/overlay/templates";

const FRAME = { width: 1920, height: 1080 };
const CTX = { hasGps: true, hasHeading: true, hasLogo: true };

describe("overlayConfigSchema", () => {
  it("validates every default template", () => {
    for (const id of ["minimal", "survey", "cinematic"] as const) {
      const cfg = instantiateTemplate(id, FRAME, CTX);
      expect(overlayConfigSchema.safeParse(cfg).success).toBe(true);
    }
  });

  it("rejects a duplicate singleton element", () => {
    const cfg = instantiateTemplate("survey", FRAME, CTX);
    const grid = cfg.elements.find((el) => el.type === "grid")!;
    const withDuplicate = { ...cfg, elements: [...cfg.elements, { ...grid, id: "grid" }] };
    expect(overlayConfigSchema.safeParse(withDuplicate).success).toBe(false);
  });

  it("rejects a static element with zIndex >= 100", () => {
    const cfg = instantiateTemplate("survey", FRAME, CTX);
    const bad = { ...cfg, elements: cfg.elements.map((el) => (el.type === "grid" ? { ...el, zIndex: 100 } : el)) };
    expect(overlayConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a dynamic element with zIndex < 100", () => {
    const cfg = instantiateTemplate("survey", FRAME, CTX);
    const bad = { ...cfg, elements: cfg.elements.map((el) => (el.type === "telemetryPanel" ? { ...el, zIndex: 50 } : el)) };
    expect(overlayConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects x + width > 1", () => {
    const cfg = instantiateTemplate("survey", FRAME, CTX);
    const bad = { ...cfg, elements: cfg.elements.map((el) => (el.type === "telemetryPanel" ? { ...el, x: 0.9, width: 0.5 } : el)) };
    expect(overlayConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects y + height > 1", () => {
    const cfg = instantiateTemplate("survey", FRAME, CTX);
    const bad = { ...cfg, elements: cfg.elements.map((el) => (el.type === "telemetryPanel" ? { ...el, y: 0.9, height: 0.5 } : el)) };
    expect(overlayConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a video marker with endTime < startTime", () => {
    const cfg = instantiateTemplate("minimal", FRAME, CTX);
    const marker = {
      id: "vm_deadbeef",
      type: "videoMarker" as const,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.05,
      opacity: 1,
      visible: true,
      zIndex: 130,
      label: "Bad marker",
      startTime: 5,
      endTime: 2,
    };
    const bad = { ...cfg, elements: [...cfg.elements, marker] };
    expect(overlayConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a video marker with endTime >= startTime", () => {
    const cfg = instantiateTemplate("minimal", FRAME, CTX);
    const marker = {
      id: "vm_deadbeef",
      type: "videoMarker" as const,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.05,
      opacity: 1,
      visible: true,
      zIndex: 130,
      label: "Good marker",
      startTime: 2,
      endTime: 5,
    };
    const good = { ...cfg, elements: [...cfg.elements, marker] };
    expect(overlayConfigSchema.safeParse(good).success).toBe(true);
  });

  it("rejects a duplicate element id even across different types", () => {
    const cfg = instantiateTemplate("minimal", FRAME, CTX);
    const marker1 = {
      id: "dup",
      type: "videoMarker" as const,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.05,
      opacity: 1,
      visible: true,
      zIndex: 130,
      label: "A",
      startTime: 0,
      endTime: 1,
    };
    const marker2 = { ...marker1, label: "B", startTime: 2, endTime: 3 };
    const bad = { ...cfg, elements: [...cfg.elements, marker1, marker2] };
    expect(overlayConfigSchema.safeParse(bad).success).toBe(false);
  });
});
