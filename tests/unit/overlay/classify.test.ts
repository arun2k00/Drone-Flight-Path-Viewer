import { describe, expect, it } from "vitest";
import { isDynamic } from "@/lib/overlay/classify";
import { instantiateTemplate } from "@/lib/overlay/templates";

const FRAME = { width: 1920, height: 1080 };
const CTX = { hasGps: true, hasHeading: true, hasLogo: true };

describe("isDynamic", () => {
  it("marks telemetryPanel, miniMap, headingIndicator and videoMarker as dynamic", () => {
    const cfg = instantiateTemplate("survey", FRAME, CTX);
    for (const type of ["telemetryPanel", "miniMap", "headingIndicator", "videoMarker"] as const) {
      const el = cfg.elements.find((e) => e.type === type);
      if (el) expect(isDynamic(el)).toBe(true);
    }
  });

  it("marks grid, crosshair, label and logo as static", () => {
    const cfg = instantiateTemplate("survey", FRAME, CTX);
    for (const type of ["grid", "crosshair", "projectLabel", "logo"] as const) {
      const el = cfg.elements.find((e) => e.type === type);
      if (el) expect(isDynamic(el)).toBe(false);
    }
  });
});
