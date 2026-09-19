import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { buildAtlasLayout } from "@/lib/overlay/atlas";
import { registerOverlayFonts } from "@/lib/overlay/assets.server";
import { isDynamic } from "@/lib/overlay/classify";
import type { DisplayValues, FrameState } from "@/lib/overlay/frame-state";
import { toPixelRect } from "@/lib/overlay/layout";
import { drawElement, drawFullFrame, type RenderContext } from "@/lib/overlay/render";
import { instantiateTemplate } from "@/lib/overlay/templates";
import type { InterpolatedTelemetry } from "@/lib/telemetry/interpolator";

registerOverlayFonts();

const FRAME = { width: 1920, height: 1080 };

function mkDisplay(): DisplayValues {
  return {
    altitude: 42.7,
    speedMps: 5.9,
    speedSource: "srt",
    heading: 187,
    headingSource: "srt",
    latitude: 17.385044,
    longitude: 78.486671,
    recordedAtMs: Date.UTC(2026, 4, 27, 13, 14, 22),
  };
}

function mkFrame(): FrameState {
  return { videoTime: 4.5, telemetry: {} as InterpolatedTelemetry, display: mkDisplay() };
}

function mkRc(): RenderContext {
  const config = instantiateTemplate("survey", FRAME, { hasGps: true, hasHeading: true, hasLogo: false });
  return {
    frameWidth: FRAME.width,
    frameHeight: FRAME.height,
    unit: Math.min(FRAME.width, FRAME.height) / 1080,
    config,
    branding: { projectName: "Parity Test", companyName: null },
    assets: { logo: null, basemap: null, flightPath: null, profile: null },
  };
}

/** Replicates the export's split exactly: static PNG + one atlas composited back on top. */
function renderViaExportSplit(rc: RenderContext, frame: FrameState): Buffer {
  const out = createCanvas(FRAME.width, FRAME.height);
  const octx = out.getContext("2d") as unknown as CanvasRenderingContext2D;

  const staticEls = rc.config.elements.filter((e) => e.visible && !isDynamic(e)).sort((a, b) => a.zIndex - b.zIndex);
  for (const el of staticEls) {
    const r = toPixelRect(el, FRAME);
    octx.save();
    octx.translate(r.x, r.y);
    octx.beginPath();
    octx.rect(0, 0, r.w, r.h);
    octx.clip();
    octx.globalAlpha = el.opacity;
    drawElement(octx, el, r.w, r.h, rc, null);
    octx.restore();
  }

  const dynamicEls = rc.config.elements.filter((e) => e.visible && isDynamic(e)).sort((a, b) => a.zIndex - b.zIndex);
  const atlas = buildAtlasLayout(dynamicEls, FRAME);
  if (atlas) {
    const elementsById = new Map(dynamicEls.map((e) => [e.id, e]));
    const atlasCanvas = createCanvas(atlas.width, atlas.height);
    const actx = atlasCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    for (const slot of atlas.slots) {
      const el = elementsById.get(slot.elementId)!;
      actx.save();
      actx.translate(0, slot.srcY);
      actx.beginPath();
      actx.rect(0, 0, slot.width, slot.height);
      actx.clip();
      actx.globalAlpha = el.opacity;
      drawElement(actx, el, slot.width, slot.height, rc, frame);
      actx.restore();
    }
    // Simulates the filtergraph's per-slot crop+overlay: draw each atlas slot back at its destination.
    for (const slot of atlas.slots) {
      octx.drawImage(atlasCanvas as unknown as CanvasImageSource, 0, slot.srcY, slot.width, slot.height, slot.destX, slot.destY, slot.width, slot.height);
    }
  }

  return Buffer.from(out.data());
}

describe("render parity: preview (drawFullFrame) vs export (static + atlas split)", () => {
  it("produces the same pixels within ±2 per channel", () => {
    const rc = mkRc();
    const frame = mkFrame();

    const preview = createCanvas(FRAME.width, FRAME.height);
    const pctx = preview.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawFullFrame(pctx, rc, frame);
    const previewData = Buffer.from(preview.data());

    const exportData = renderViaExportSplit(rc, frame);

    expect(previewData.length).toBe(exportData.length);
    let diffCount = 0;
    for (let i = 0; i < previewData.length; i++) {
      if (Math.abs(previewData[i] - exportData[i]) > 2) diffCount++;
    }
    // atlas slot dimensions round to even pixels, so a handful of bytes right at an
    // element's edge can legitimately differ from the preview's unrounded box — "invisible", per the doc.
    expect(diffCount).toBeLessThan(50);
  });

  it("stays within tolerance across two different frame states (dynamic content actually redraws identically)", () => {
    const rc = mkRc();
    for (const videoTime of [1, 8]) {
      const frame: FrameState = { videoTime, telemetry: {} as InterpolatedTelemetry, display: { ...mkDisplay(), altitude: 20 + videoTime * 3, heading: (videoTime * 40) % 360 } };
      const preview = createCanvas(FRAME.width, FRAME.height);
      const pctx = preview.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawFullFrame(pctx, rc, frame);
      const previewData = Buffer.from(preview.data());
      const exportData = renderViaExportSplit(rc, frame);
      let diffCount = 0;
      for (let i = 0; i < previewData.length; i++) if (Math.abs(previewData[i] - exportData[i]) > 2) diffCount++;
      expect(diffCount).toBeLessThan(50);
    }
  });
});
