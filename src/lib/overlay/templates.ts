import { boxFromSpec, aspectClass, type BoxSpecU, type Frame } from "./layout";
import type { GridElement, OverlayConfig, OverlayElement } from "./model";

export type TemplateId = "minimal" | "survey" | "cinematic";

export interface TemplateContext {
  hasGps: boolean;
  hasHeading: boolean;
  hasLogo: boolean;
}

/** overlay-engine.md zIndex bands: static < 100, dynamic >= 100. */
const Z = {
  grid: 0,
  crosshair: 10,
  projectLabel: 20,
  logo: 30,
  miniMap: 100,
  telemetryPanel: 110,
  headingIndicator: 120,
  altitudeGraph: 130,
  speedGraph: 140,
} as const;

const CROSSHAIR_DEFAULT_SIZE = 64;

function telemetryPanelBox(aspect: ReturnType<typeof aspectClass>): BoxSpecU {
  if (aspect === "landscape") return { anchor: "bl", marginX: 48, marginY: 48, width: 360, height: 0 };
  if (aspect === "portrait") return { anchor: "bl", marginX: 40, marginY: 64, width: 420, height: 0 };
  return { anchor: "bl", marginX: 32, marginY: 32, width: 340, height: 0 };
}

function miniMapBox(aspect: ReturnType<typeof aspectClass>, anchor: "tr" | "br"): BoxSpecU {
  if (aspect === "landscape") return { anchor, marginX: 48, marginY: 48, width: 420, height: 300 };
  if (aspect === "portrait") return { anchor, marginX: 40, marginY: 64, width: 400, height: 400 };
  return { anchor, marginX: 32, marginY: 32, width: 340, height: 260 };
}

function headingIndicatorBox(aspect: ReturnType<typeof aspectClass>): BoxSpecU {
  if (aspect === "landscape") return { anchor: "bc", marginX: 0, marginY: 48, width: 360, height: 60 };
  if (aspect === "portrait") return { anchor: "tc", marginX: 0, marginY: 500, width: 360, height: 60 };
  return { anchor: "bc", marginX: 0, marginY: 32, width: 300, height: 56 };
}

function projectLabelBox(aspect: ReturnType<typeof aspectClass>): BoxSpecU {
  if (aspect === "landscape") return { anchor: "tl", marginX: 48, marginY: 48, width: 560, height: 96 };
  if (aspect === "portrait") return { anchor: "tl", marginX: 40, marginY: 64, width: 560, height: 96 };
  return { anchor: "tl", marginX: 32, marginY: 32, width: 480, height: 96 };
}

function logoBox(aspect: ReturnType<typeof aspectClass>, anchor: "tl" | "br"): BoxSpecU {
  if (aspect === "landscape") return { anchor, marginX: 48, marginY: 48, width: 200, height: 100 };
  if (aspect === "portrait") return { anchor, marginX: 40, marginY: 64, width: 200, height: 100 };
  return { anchor, marginX: 32, marginY: 32, width: 180, height: 90 };
}

/** Stacked under the mini-map on the right; hidden by default. */
function graphBox(aspect: ReturnType<typeof aspectClass>, slot: 0 | 1): BoxSpecU {
  if (aspect === "landscape") return { anchor: "tr", marginX: 48, marginY: 372 + slot * 166, width: 420, height: 150 };
  if (aspect === "portrait") return { anchor: "tr", marginX: 40, marginY: 488 + slot * 176, width: 400, height: 160 };
  return { anchor: "tr", marginX: 32, marginY: 308 + slot * 150, width: 340, height: 136 };
}

function graphElements(frame: Frame): OverlayElement[] {
  const aspect = aspectClass(frame);
  return (["altitudeGraph", "speedGraph"] as const).map((type, slot) => ({
    id: type,
    type,
    ...boxFromSpec(graphBox(aspect, slot as 0 | 1), frame),
    opacity: 1,
    visible: false,
    zIndex: Z[type],
    background: "panel" as const,
    backgroundOpacity: 0.62,
  }));
}

/** Configs saved before the graph widgets existed get them appended (hidden), so the editor can offer them. */
export function withGraphWidgets(config: OverlayConfig, frame: Frame): OverlayConfig {
  const missing = graphElements(frame).filter((g) => !config.elements.some((el) => el.type === g.type));
  return missing.length ? { ...config, elements: [...config.elements, ...missing] } : config;
}

function crosshairBox(): BoxSpecU {
  const side = CROSSHAIR_DEFAULT_SIZE + 8;
  return { anchor: "center", marginX: 0, marginY: 0, width: side, height: side };
}

function panelRowCount(hasHeading: boolean): number {
  return hasHeading ? 5 : 4;
}

function panelHeightU(rows: number): number {
  return 36 + 46 * rows;
}

/** survey if GPS is available (a route worth showing), else minimal. */
export function defaultOverlayConfig(frame: Frame, ctx: TemplateContext): OverlayConfig {
  return instantiateTemplate(ctx.hasGps ? "survey" : "minimal", frame, ctx);
}

export function instantiateTemplate(id: TemplateId, frame: Frame, ctx: TemplateContext): OverlayConfig {
  const aspect = aspectClass(frame);
  const showHeadingRow = id === "survey" && ctx.hasHeading;
  const rows = panelRowCount(showHeadingRow);

  const panelSpec = telemetryPanelBox(aspect);
  panelSpec.height = panelHeightU(rows);
  const panelBox = boxFromSpec(panelSpec, frame);

  const showMiniMap = id === "survey" || id === "cinematic";
  const miniMapAnchor: "tr" | "br" = id === "survey" ? "tr" : "br";
  const miniMapBoxRect = boxFromSpec(miniMapBox(aspect, miniMapAnchor), frame);

  const headingBox = boxFromSpec(headingIndicatorBox(aspect), frame);
  const labelBox = boxFromSpec(projectLabelBox(aspect), frame);

  const showLogo = ctx.hasLogo && (id === "survey" || id === "cinematic");
  const logoAnchor: "tl" | "br" = id === "survey" ? "br" : "tl";
  const logoBoxRect = boxFromSpec(logoBox(aspect, logoAnchor), frame);

  const crosshairBoxRect = boxFromSpec(crosshairBox(), frame);

  const elements: OverlayElement[] = [
    {
      id: "telemetryPanel",
      type: "telemetryPanel",
      ...panelBox,
      opacity: 1,
      visible: true,
      zIndex: Z.telemetryPanel,
      fields: { altitude: true, speed: true, coordinates: true, heading: showHeadingRow, time: false },
      background: "panel",
      backgroundOpacity: 0.62,
    },
    {
      id: "miniMap",
      type: "miniMap",
      ...miniMapBoxRect,
      opacity: 1,
      visible: showMiniMap,
      zIndex: Z.miniMap,
      showPath: id === "survey" || id === "cinematic",
      showProgress: id === "survey" || id === "cinematic",
      showStartEnd: id === "survey",
      showHeading: id === "survey" || id === "cinematic",
      showNorthArrow: id === "survey" || id === "cinematic",
      showScaleBar: id === "survey",
      showMarkers: true,
      basemap: "none",
      paddingRatio: 0.12,
    },
    {
      id: "grid",
      type: "grid",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      opacity: 0.22,
      visible: id === "survey",
      zIndex: Z.grid,
      style: "lines",
      cellSize: 120,
      lineWidth: 1,
      majorEvery: 4,
    } satisfies GridElement,
    {
      id: "crosshair",
      type: "crosshair",
      ...crosshairBoxRect,
      opacity: 0.9,
      visible: false,
      zIndex: Z.crosshair,
      size: CROSSHAIR_DEFAULT_SIZE,
      lineWidth: 1.5,
      gap: 8,
      showCenterDot: false,
    },
    {
      id: "headingIndicator",
      type: "headingIndicator",
      ...headingBox,
      opacity: 1,
      visible: showHeadingRow,
      zIndex: Z.headingIndicator,
    },
    {
      id: "projectLabel",
      type: "projectLabel",
      ...labelBox,
      opacity: 1,
      visible: id === "survey",
      zIndex: Z.projectLabel,
      caption: "PROJECT",
      showCompany: true,
      background: "none",
    },
    {
      id: "logo",
      type: "logo",
      ...logoBoxRect,
      opacity: 1,
      visible: showLogo,
      zIndex: Z.logo,
    },
    ...graphElements(frame),
  ];

  return {
    version: 1,
    template: id,
    elements,
    mapMarkers: [],
    units: { speed: "km/h", altitude: "m", coordinates: "decimal" },
    altitudeSource: "relative",
    accentColor: "#FFB020",
  };
}
