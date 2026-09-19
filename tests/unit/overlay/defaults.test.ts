import { describe, expect, it } from "vitest";
import { overlayConfigSchema } from "@/lib/overlay/model";
import { placeholderOverlayConfig } from "@/lib/overlay/defaults";

describe("placeholderOverlayConfig", () => {
  it("returns an empty, schema-valid config for projects with no video yet", () => {
    const cfg = placeholderOverlayConfig();
    expect(cfg.elements).toEqual([]);
    expect(cfg.mapMarkers).toEqual([]);
    expect(cfg.template).toBe("minimal");
    expect(overlayConfigSchema.safeParse(cfg).success).toBe(true);
  });
});
