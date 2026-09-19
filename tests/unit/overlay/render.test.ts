import { createCanvas, loadImage } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { registerOverlayFonts } from "@/lib/overlay/assets.server";
import { unitOf } from "@/lib/overlay/layout";
import type {
  CrosshairElement,
  GridElement,
  HeadingIndicatorElement,
  LogoElement,
  MiniMapElement,
  OverlayConfig,
  ProjectLabelElement,
  TelemetryPanelElement,
  VideoMarkerElement,
} from "@/lib/overlay/model";
import { drawElement, drawFullFrame, type RenderContext } from "@/lib/overlay/render";
import { buildProfile, PROFILE_MAX_POINTS } from "@/lib/telemetry/profile";
import { pointsToSeries } from "@/lib/telemetry/series";
import type { TelemetryPoint } from "@/types/telemetry";
import { instantiateTemplate } from "@/lib/overlay/templates";
import type { DisplayValues, FrameState } from "@/lib/overlay/frame-state";
import type { InterpolatedTelemetry } from "@/lib/telemetry/interpolator";
import type { FlightPathGeoJson } from "@/lib/map/geojson";

registerOverlayFonts();

function mkDisplay(overrides: Partial<DisplayValues> = {}): DisplayValues {
  return {
    altitude: 42.7,
    speedMps: 5.9,
    speedSource: "srt",
    heading: 187,
    headingSource: "srt",
    latitude: 17.385044,
    longitude: 78.486671,
    recordedAtMs: Date.UTC(2026, 4, 27, 13, 14, 22),
    ...overrides,
  };
}

function mkFrame(display: DisplayValues): FrameState {
  return { videoTime: 1.5, telemetry: {} as InterpolatedTelemetry, display };
}

function mkRc(frame: { width: number; height: number }, patch: Partial<OverlayConfig> = {}): RenderContext {
  const config = { ...instantiateTemplate("survey", frame, { hasGps: true, hasHeading: true, hasLogo: false }), ...patch };
  return {
    frameWidth: frame.width,
    frameHeight: frame.height,
    unit: unitOf(frame),
    config,
    branding: { projectName: "Test Project", companyName: null },
    assets: { logo: null, basemap: null, flightPath: null, profile: null },
  };
}

function panelOf(config: OverlayConfig): TelemetryPanelElement {
  return config.elements.find((el): el is TelemetryPanelElement => el.type === "telemetryPanel")!;
}

function miniMapOf(config: OverlayConfig): MiniMapElement {
  return config.elements.find((el): el is MiniMapElement => el.type === "miniMap")!;
}

function headingIndicatorOf(config: OverlayConfig): HeadingIndicatorElement {
  return config.elements.find((el): el is HeadingIndicatorElement => el.type === "headingIndicator")!;
}

function gridOf(config: OverlayConfig): GridElement {
  return config.elements.find((el): el is GridElement => el.type === "grid")!;
}

function crosshairOf(config: OverlayConfig): CrosshairElement {
  return config.elements.find((el): el is CrosshairElement => el.type === "crosshair")!;
}

function projectLabelOf(config: OverlayConfig): ProjectLabelElement {
  return config.elements.find((el): el is ProjectLabelElement => el.type === "projectLabel")!;
}

function logoOf(config: OverlayConfig): LogoElement {
  return config.elements.find((el): el is LogoElement => el.type === "logo")!;
}

async function mkOpaquePng(w: number, h: number): Promise<Buffer> {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(0, 0, w, h);
  return canvas.encode("png");
}

function mkVideoMarker(overrides: Partial<VideoMarkerElement> = {}): VideoMarkerElement {
  return {
    id: "vm1",
    type: "videoMarker",
    x: 0.1,
    y: 0.85,
    width: 0.3,
    height: 0.08,
    opacity: 1,
    visible: true,
    zIndex: 900,
    label: "POINT A",
    startTime: 1,
    endTime: 4,
    ...overrides,
  };
}

/** A short square-ish path near Hyderabad, four points, for mini-map rendering tests. */
const SYNTHETIC_FLIGHT_PATH: FlightPathGeoJson = {
  type: "FeatureCollection",
  bbox: [78.4855, 17.3835, 78.4879, 17.3866],
  features: [
    {
      type: "Feature",
      properties: { kind: "path", times: [0, 1, 2, 3], sampleIndices: [0, 1, 2, 3], toleranceMeters: 0.5, sourcePointCount: 4, lengthMeters: 400 },
      geometry: {
        type: "LineString",
        coordinates: [
          [78.4855, 17.3835],
          [78.4879, 17.3835],
          [78.4879, 17.3866],
          [78.4855, 17.3866],
        ],
      },
    },
    { type: "Feature", properties: { kind: "start", time: 0 }, geometry: { type: "Point", coordinates: [78.4855, 17.3835] } },
    { type: "Feature", properties: { kind: "end", time: 3 }, geometry: { type: "Point", coordinates: [78.4855, 17.3866] } },
  ],
};

function mkFrameAt(srtTime: number, display: DisplayValues): FrameState {
  return { videoTime: srtTime, telemetry: { srtTime } as InterpolatedTelemetry, display };
}

describe("drawTelemetryPanel", () => {
  it("draws without throwing at 1080p and 4K", () => {
    for (const frame of [
      { width: 1920, height: 1080 },
      { width: 3840, height: 2160 },
    ]) {
      const rc = mkRc(frame);
      const panel = panelOf(rc.config);
      const canvas = createCanvas(400, 300);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      expect(() => drawElement(ctx, panel, 400, 300, rc, mkFrame(mkDisplay()))).not.toThrow();
    }
  });

  it("produces different pixels for two different frame states", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const panel = panelOf(rc.config);

    const render = (display: DisplayValues) => {
      const canvas = createCanvas(360, 260);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawElement(ctx, panel, 360, 260, rc, mkFrame(display));
      return Buffer.from(canvas.data());
    };

    const a = render(mkDisplay({ altitude: 10 }));
    const b = render(mkDisplay({ altitude: 200 }));
    expect(a.equals(b)).toBe(false);
  });

  it("draws the GPS-unavailable path when coordinates are enabled and latitude is null", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const panel = panelOf(rc.config);
    const canvas = createCanvas(360, 260);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(() => drawElement(ctx, panel, 360, 260, rc, mkFrame(mkDisplay({ latitude: null, longitude: null })))).not.toThrow();

    // The panel drew *something* (not just the blank background) — non-transparent, non-background pixels exist.
    const withGps = (() => {
      const c2 = createCanvas(360, 260);
      const ctx2 = c2.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawElement(ctx2, panel, 360, 260, rc, mkFrame(mkDisplay()));
      return Buffer.from(c2.data());
    })();
    const withoutGps = (() => {
      const c3 = createCanvas(360, 260);
      const ctx3 = c3.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawElement(ctx3, panel, 360, 260, rc, mkFrame(mkDisplay({ latitude: null, longitude: null })));
      return Buffer.from(c3.data());
    })();
    expect(withGps.equals(withoutGps)).toBe(false);
  });

  it("straight (non-premultiplied) alpha via getImageData: a half-opacity red pixel keeps full-range RGB", () => {
    const canvas = createCanvas(4, 4);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
    ctx.fillRect(0, 0, 4, 4);
    const px = ctx.getImageData(0, 0, 1, 1).data;
    expect(px[0]).toBe(255);
    expect(px[1]).toBe(0);
    expect(px[3]).toBeGreaterThan(120);
    expect(px[3]).toBeLessThan(135);
  });
});

describe("drawFullFrame", () => {
  it("draws every visible element of a template without throwing", () => {
    for (const templateId of ["minimal", "survey", "cinematic"] as const) {
      const frame = { width: 1920, height: 1080 };
      const rc = mkRc(frame, instantiateTemplate(templateId, frame, { hasGps: true, hasHeading: true, hasLogo: true }));
      const canvas = createCanvas(frame.width, frame.height);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      expect(() => drawFullFrame(ctx, rc, mkFrame(mkDisplay()))).not.toThrow();
    }
  });

});

describe("drawMiniMap", () => {
  it("draws the graticule + GPS-unavailable text without throwing when there is no flight path", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const miniMap = miniMapOf(rc.config);
    const canvas = createCanvas(420, 300);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(() => drawElement(ctx, miniMap, 420, 300, rc, mkFrame(mkDisplay()))).not.toThrow();
  });

  it("draws the route, start/end markers and a moving position dot without throwing", () => {
    const frame = { width: 1920, height: 1080 };
    const rcWithPath: RenderContext = { ...mkRc(frame), assets: { logo: null, basemap: null, flightPath: SYNTHETIC_FLIGHT_PATH, profile: null } };
    const miniMap = miniMapOf(rcWithPath.config);
    const canvas = createCanvas(420, 300);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(() => drawElement(ctx, miniMap, 420, 300, rcWithPath, mkFrameAt(1.5, mkDisplay({ latitude: 17.385, longitude: 78.4867 })))).not.toThrow();
  });

  it("produces different pixels as the drone moves along the path (progress line advances)", () => {
    const frame = { width: 1920, height: 1080 };
    const rcWithPath: RenderContext = { ...mkRc(frame), assets: { logo: null, basemap: null, flightPath: SYNTHETIC_FLIGHT_PATH, profile: null } };
    const miniMap = miniMapOf(rcWithPath.config);

    const render = (srtTime: number, lat: number, lon: number) => {
      const canvas = createCanvas(420, 300);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawElement(ctx, miniMap, 420, 300, rcWithPath, mkFrameAt(srtTime, mkDisplay({ latitude: lat, longitude: lon })));
      return Buffer.from(canvas.data());
    };

    const early = render(0.2, 17.3836, 78.486);
    const late = render(2.8, 17.3865, 78.4856);
    expect(early.equals(late)).toBe(false);
  });

  it("draws the GPS-unavailable centred text when the flight path exists but the current position is null", () => {
    const frame = { width: 1920, height: 1080 };
    const rcWithPath: RenderContext = { ...mkRc(frame), assets: { logo: null, basemap: null, flightPath: SYNTHETIC_FLIGHT_PATH, profile: null } };
    const miniMap = miniMapOf(rcWithPath.config);

    const render = (display: DisplayValues) => {
      const canvas = createCanvas(420, 300);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawElement(ctx, miniMap, 420, 300, rcWithPath, mkFrameAt(1, display));
      return Buffer.from(canvas.data());
    };

    const withGps = render(mkDisplay({ latitude: 17.385, longitude: 78.4867 }));
    const withoutGps = render(mkDisplay({ latitude: null, longitude: null }));
    expect(withGps.equals(withoutGps)).toBe(false);
  });

  it("rotates the position arrow when showHeading is on and heading is available", () => {
    const frame = { width: 1920, height: 1080 };
    const rcWithPath: RenderContext = { ...mkRc(frame), assets: { logo: null, basemap: null, flightPath: SYNTHETIC_FLIGHT_PATH, profile: null } };
    const miniMap = miniMapOf(rcWithPath.config);
    expect(miniMap.showHeading).toBe(true);

    const render = (heading: number | null) => {
      const canvas = createCanvas(420, 300);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawElement(ctx, miniMap, 420, 300, rcWithPath, mkFrameAt(1, mkDisplay({ latitude: 17.385, longitude: 78.4867, heading })));
      return Buffer.from(canvas.data());
    };

    expect(render(10).equals(render(190))).toBe(false);
  });
});

describe("drawHeadingIndicator", () => {
  it("draws 'HDG —' without throwing when heading is unavailable", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const heading = headingIndicatorOf(rc.config);
    const canvas = createCanvas(360, 60);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(() => drawElement(ctx, heading, 360, 60, rc, mkFrame(mkDisplay({ heading: null })))).not.toThrow();
  });

  it("draws a moving tape and produces different pixels for different heading values", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const headingEl = headingIndicatorOf(rc.config);

    const render = (heading: number) => {
      const canvas = createCanvas(360, 60);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawElement(ctx, headingEl, 360, 60, rc, mkFrame(mkDisplay({ heading })));
      return Buffer.from(canvas.data());
    };

    expect(render(10).equals(render(200))).toBe(false);
  });

  it("draws without throwing at a wrap-around heading (359°) and near 0°", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const headingEl = headingIndicatorOf(rc.config);
    const canvas = createCanvas(360, 60);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    expect(() => drawElement(ctx, headingEl, 360, 60, rc, mkFrame(mkDisplay({ heading: 359 })))).not.toThrow();
    expect(() => drawElement(ctx, headingEl, 360, 60, rc, mkFrame(mkDisplay({ heading: 1 })))).not.toThrow();
  });
});

describe("drawGrid", () => {
  it("draws without throwing for both styles", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const grid = gridOf(rc.config);
    for (const style of ["lines", "dotted"] as const) {
      const el = { ...grid, style, visible: true };
      const canvas = createCanvas(400, 300);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      expect(() => drawElement(ctx, el, 400, 300, rc, mkFrame(mkDisplay()))).not.toThrow();
    }
  });

  it("produces different pixels for lines vs dotted", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const grid = gridOf(rc.config);

    const render = (style: GridElement["style"]) => {
      const canvas = createCanvas(400, 300);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawElement(ctx, { ...grid, style, visible: true }, 400, 300, rc, mkFrame(mkDisplay()));
      return Buffer.from(canvas.data());
    };

    expect(render("lines").equals(render("dotted"))).toBe(false);
  });

  it("produces different pixels when majorEvery changes the major-line pattern", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const grid = gridOf(rc.config);

    const render = (majorEvery: number) => {
      const canvas = createCanvas(400, 300);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawElement(ctx, { ...grid, visible: true, majorEvery }, 400, 300, rc, mkFrame(mkDisplay()));
      return Buffer.from(canvas.data());
    };

    expect(render(4).equals(render(0))).toBe(false);
  });
});

describe("drawCrosshair", () => {
  it("draws without throwing with and without the centre dot", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const crosshair = crosshairOf(rc.config);
    for (const showCenterDot of [true, false]) {
      const canvas = createCanvas(200, 200);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      expect(() => drawElement(ctx, { ...crosshair, visible: true, showCenterDot }, 200, 200, rc, mkFrame(mkDisplay()))).not.toThrow();
    }
  });

  it("produces different pixels with the centre dot on vs off", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const crosshair = crosshairOf(rc.config);

    const render = (showCenterDot: boolean) => {
      const canvas = createCanvas(200, 200);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawElement(ctx, { ...crosshair, visible: true, showCenterDot }, 200, 200, rc, mkFrame(mkDisplay()));
      return Buffer.from(canvas.data());
    };

    expect(render(true).equals(render(false))).toBe(false);
  });
});

describe("drawProjectLabel", () => {
  it("draws without throwing with and without a company name, and with either background", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const label = projectLabelOf(rc.config);
    for (const background of ["panel", "none"] as const) {
      for (const showCompany of [true, false]) {
        const canvas = createCanvas(500, 160);
        const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
        expect(() =>
          drawElement(ctx, { ...label, visible: true, background, showCompany }, 500, 160, rc, mkFrame(mkDisplay())),
        ).not.toThrow();
      }
    }
  });

  it("produces different pixels when the company line is shown vs hidden", () => {
    const frame = { width: 1920, height: 1080 };
    const rc: RenderContext = { ...mkRc(frame), branding: { projectName: "Test Project", companyName: "Acme Co" } };
    const label = projectLabelOf(rc.config);

    const render = (showCompany: boolean) => {
      const canvas = createCanvas(500, 160);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      drawElement(ctx, { ...label, visible: true, showCompany }, 500, 160, rc, mkFrame(mkDisplay()));
      return Buffer.from(canvas.data());
    };

    expect(render(true).equals(render(false))).toBe(false);
  });
});

describe("drawLogo", () => {
  it("is a no-op when there is no logo asset", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const logo = logoOf(rc.config);
    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 200, 200);
    drawElement(ctx, { ...logo, visible: true }, 200, 200, rc, mkFrame(mkDisplay()));
    const px = ctx.getImageData(0, 0, 200, 200).data;
    expect(px.every((v) => v === 0)).toBe(true);
  });

  it("contain-fits and centres the logo image when an asset is present", async () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const logo = logoOf(rc.config);
    const image = await loadImage(await mkOpaquePng(40, 20));
    const rcWithLogo: RenderContext = { ...rc, assets: { ...rc.assets, logo: image as unknown as CanvasImageSource } };
    const canvas = createCanvas(200, 100);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 200, 100);
    expect(() => drawElement(ctx, { ...logo, visible: true }, 200, 100, rcWithLogo, mkFrame(mkDisplay()))).not.toThrow();
    const px = ctx.getImageData(0, 0, 200, 100).data;
    expect(px.some((v) => v !== 0)).toBe(true);
  });
});

describe("drawVideoMarker", () => {
  it("draws within its time window and is invisible outside it", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const marker = mkVideoMarker({ startTime: 1, endTime: 4 });

    const render = (videoTime: number) => {
      const canvas = createCanvas(400, 60);
      const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, 400, 60);
      drawElement(ctx, marker, 400, 60, rc, { videoTime, telemetry: {} as never, display: mkDisplay() });
      return ctx.getImageData(0, 0, 400, 60).data;
    };

    const before = render(0.5);
    const during = render(2.5);
    const after = render(4.5);

    expect(Array.from(before).every((v) => v === 0)).toBe(true);
    expect(Array.from(after).every((v) => v === 0)).toBe(true);
    expect(Array.from(during).some((v) => v !== 0)).toBe(true);
  });

  it("is invisible when there is no frame state", () => {
    const frame = { width: 1920, height: 1080 };
    const rc = mkRc(frame);
    const marker = mkVideoMarker({ startTime: 1, endTime: 4 });
    const canvas = createCanvas(400, 60);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 400, 60);
    drawElement(ctx, marker, 400, 60, rc, null);
    const px = ctx.getImageData(0, 0, 400, 60).data;
    expect(Array.from(px).every((v) => v === 0)).toBe(true);
  });
});

describe("graph widgets", () => {
  const frame = { width: 1920, height: 1080 };
  const point = (i: number): TelemetryPoint => ({
    timestamp: i, startTime: i - 0.5, endTime: i + 0.5, latitude: null, longitude: null,
    relativeAltitude: i < 20 || i > 25 ? i * 2 : null, absoluteAltitude: null, speedX: null, speedY: null, speedZ: null,
    speed: 5 + Math.sin(i / 5), heading: null, aircraftPitch: null, aircraftRoll: null, aircraftYaw: null,
    gimbalPitch: null, gimbalRoll: null, gimbalYaw: null, recordedAt: null, frameIndex: null, cueOrdinal: i,
  });
  const profile = buildProfile(pointsToSeries(Array.from({ length: 50 }, (_, i) => point(i))));
  const at = (srtTime: number, altitude: number | null): FrameState => ({
    videoTime: srtTime,
    telemetry: { srtTime } as InterpolatedTelemetry,
    display: mkDisplay({ altitude, speedMps: 5 }),
  });
  const render = (type: "altitudeGraph" | "speedGraph", withProfile: boolean, f: FrameState) => {
    const rc = mkRc(frame);
    rc.assets.profile = withProfile ? profile : null;
    const el = rc.config.elements.find((e) => e.type === type)!;
    const canvas = createCanvas(420, 150);
    drawElement(canvas.getContext("2d") as unknown as CanvasRenderingContext2D, el, 420, 150, rc, f);
    return Buffer.from(canvas.data());
  };

  it("buildProfile downsamples long flights and falls back to NaN gaps", () => {
    expect(profile.t.length).toBe(50);
    expect(Number.isNaN(profile.relativeAltitude[22])).toBe(true);
    const long = buildProfile(pointsToSeries(Array.from({ length: 5000 }, (_, i) => point(i))));
    expect(long.t.length).toBeLessThanOrEqual(PROFILE_MAX_POINTS);
  });

  it("the cursor moves: start and end of flight render differently", () => {
    for (const type of ["altitudeGraph", "speedGraph"] as const) {
      expect(render(type, true, at(0, 0)).equals(render(type, true, at(49, 98)))).toBe(false);
    }
  });

  it("renders a placeholder, not a crash, without telemetry", () => {
    expect(() => render("altitudeGraph", false, at(0, null))).not.toThrow();
  });
});
