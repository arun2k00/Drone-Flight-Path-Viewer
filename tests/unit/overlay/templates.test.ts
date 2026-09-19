import { describe, expect, it } from "vitest";
import { toPixelRect } from "@/lib/overlay/layout";
import { overlayConfigSchema } from "@/lib/overlay/model";
import { defaultOverlayConfig, instantiateTemplate, withGraphWidgets, type TemplateId } from "@/lib/overlay/templates";

const FRAMES = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 1080 },
  { width: 1080, height: 1920 },
  { width: 1080, height: 1080 },
  { width: 3840, height: 2160 },
];

const TEMPLATES: TemplateId[] = ["minimal", "survey", "cinematic"];

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe("instantiateTemplate — layout matrix", () => {
  for (const templateId of TEMPLATES) {
    for (const frame of FRAMES) {
      it(`${templateId} @ ${frame.width}x${frame.height}: every visible box lies inside the frame`, () => {
        const cfg = instantiateTemplate(templateId, frame, { hasGps: true, hasHeading: true, hasLogo: true });
        for (const el of cfg.elements) {
          if (!el.visible) continue;
          const rect = toPixelRect(el, frame);
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.w).toBeLessThanOrEqual(frame.width + 1);
          expect(rect.y + rect.h).toBeLessThanOrEqual(frame.height + 1);
        }
      });

      it(`${templateId} @ ${frame.width}x${frame.height}: no two visible non-grid boxes overlap`, () => {
        const cfg = instantiateTemplate(templateId, frame, { hasGps: true, hasHeading: true, hasLogo: true });
        const boxes = cfg.elements.filter((el) => el.visible && el.type !== "grid").map((el) => ({ id: el.id, ...toPixelRect(el, frame) }));
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            expect(rectsOverlap(boxes[i], boxes[j]), `${boxes[i].id} overlaps ${boxes[j].id}`).toBe(false);
          }
        }
      });
    }
  }
});

describe("instantiateTemplate — context flags", () => {
  const frame = { width: 1920, height: 1080 };

  it("hides the heading indicator and the panel's HDG row when hasHeading is false", () => {
    const cfg = instantiateTemplate("survey", frame, { hasGps: true, hasHeading: false, hasLogo: true });
    const heading = cfg.elements.find((el) => el.type === "headingIndicator")!;
    const panel = cfg.elements.find((el) => el.type === "telemetryPanel" && el.type === "telemetryPanel")!;
    expect(heading.visible).toBe(false);
    expect(panel.type === "telemetryPanel" && panel.fields.heading).toBe(false);
  });

  it("shows the heading indicator and the panel's HDG row for survey when hasHeading is true", () => {
    const cfg = instantiateTemplate("survey", frame, { hasGps: true, hasHeading: true, hasLogo: true });
    const heading = cfg.elements.find((el) => el.type === "headingIndicator")!;
    const panel = cfg.elements.find((el) => el.type === "telemetryPanel")!;
    expect(heading.visible).toBe(true);
    expect(panel.type === "telemetryPanel" && panel.fields.heading).toBe(true);
  });

  it("toggles the logo with hasLogo for survey and cinematic", () => {
    const withLogo = instantiateTemplate("survey", frame, { hasGps: true, hasHeading: true, hasLogo: true });
    const withoutLogo = instantiateTemplate("survey", frame, { hasGps: true, hasHeading: true, hasLogo: false });
    expect(withLogo.elements.find((el) => el.type === "logo")!.visible).toBe(true);
    expect(withoutLogo.elements.find((el) => el.type === "logo")!.visible).toBe(false);
  });

  it("never shows the logo for minimal regardless of hasLogo", () => {
    const cfg = instantiateTemplate("minimal", frame, { hasGps: true, hasHeading: true, hasLogo: true });
    expect(cfg.elements.find((el) => el.type === "logo")!.visible).toBe(false);
  });

  it("every template emits exactly the nine singleton elements", () => {
    for (const templateId of TEMPLATES) {
      const cfg = instantiateTemplate(templateId, frame, { hasGps: true, hasHeading: true, hasLogo: true });
      const types = cfg.elements.map((el) => el.type).sort();
      expect(types).toEqual(["altitudeGraph", "crosshair", "grid", "headingIndicator", "logo", "miniMap", "projectLabel", "speedGraph", "telemetryPanel"].sort());
    }
  });

  it("graph widgets are hidden by default and fit every aspect ratio", () => {
    for (const f of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }, { width: 1440, height: 1080 }, { width: 1280, height: 720 }]) {
      const cfg = instantiateTemplate("survey", f, { hasGps: true, hasHeading: true, hasLogo: true });
      expect(overlayConfigSchema.safeParse(cfg).success).toBe(true);
      expect(cfg.elements.filter((el) => el.type.endsWith("Graph")).every((el) => !el.visible)).toBe(true);
    }
  });

  it("withGraphWidgets adds the graphs to old configs exactly once", () => {
    const cfg = instantiateTemplate("minimal", frame, { hasGps: true, hasHeading: false, hasLogo: false });
    const old = { ...cfg, elements: cfg.elements.filter((el) => !el.type.endsWith("Graph")) };
    const upgraded = withGraphWidgets(old, frame);
    expect(upgraded.elements.filter((el) => el.type.endsWith("Graph"))).toHaveLength(2);
    expect(withGraphWidgets(upgraded, frame)).toBe(upgraded);
    expect(overlayConfigSchema.safeParse(upgraded).success).toBe(true);
  });
});

describe("defaultOverlayConfig", () => {
  const frame = { width: 1920, height: 1080 };

  it("picks survey when GPS is available", () => {
    expect(defaultOverlayConfig(frame, { hasGps: true, hasHeading: false, hasLogo: false }).template).toBe("survey");
  });

  it("picks minimal when GPS is unavailable", () => {
    expect(defaultOverlayConfig(frame, { hasGps: false, hasHeading: false, hasLogo: false }).template).toBe("minimal");
  });
});
