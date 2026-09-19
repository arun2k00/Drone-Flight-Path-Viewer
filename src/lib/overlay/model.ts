import { z } from "zod";

const unit01 = z.number().min(0).max(1);
const size01 = z.number().min(0.002).max(1);

const base = {
  id: z.string().min(1).max(64),
  x: unit01,
  y: unit01,
  width: size01,
  height: size01,
  opacity: unit01,
  visible: z.boolean(),
  zIndex: z.number().int().min(0).max(1000),
};

export const telemetryPanelSchema = z.object({
  ...base,
  type: z.literal("telemetryPanel"),
  fields: z.object({
    altitude: z.boolean(),
    speed: z.boolean(),
    coordinates: z.boolean(),
    heading: z.boolean(),
    time: z.boolean(),
  }),
  background: z.enum(["panel", "none"]),
  backgroundOpacity: unit01,
});

export const miniMapSchema = z.object({
  ...base,
  type: z.literal("miniMap"),
  showPath: z.boolean(),
  showProgress: z.boolean(),
  showStartEnd: z.boolean(),
  showHeading: z.boolean(),
  showNorthArrow: z.boolean(),
  showScaleBar: z.boolean(),
  showMarkers: z.boolean(),
  basemap: z.enum(["none", "map", "satellite"]),
  paddingRatio: z.number().min(0).max(0.3),
});

export const gridSchema = z.object({
  ...base,
  type: z.literal("grid"),
  style: z.enum(["lines", "dotted"]),
  cellSize: z.number().min(20).max(600),
  lineWidth: z.number().min(0.5).max(6),
  majorEvery: z.number().int().min(0).max(20),
});

export const crosshairSchema = z.object({
  ...base,
  type: z.literal("crosshair"),
  size: z.number().min(16).max(400),
  lineWidth: z.number().min(0.5).max(8),
  gap: z.number().min(0).max(100),
  showCenterDot: z.boolean(),
});

export const headingIndicatorSchema = z.object({ ...base, type: z.literal("headingIndicator") });

export const projectLabelSchema = z.object({
  ...base,
  type: z.literal("projectLabel"),
  caption: z.string().max(40),
  showCompany: z.boolean(),
  background: z.enum(["panel", "none"]),
});

/** Altitude / speed over the whole flight, with a cursor at the current moment. */
const graphFields = { background: z.enum(["panel", "none"]), backgroundOpacity: unit01 };
export const altitudeGraphSchema = z.object({ ...base, type: z.literal("altitudeGraph"), ...graphFields });
export const speedGraphSchema = z.object({ ...base, type: z.literal("speedGraph"), ...graphFields });

export const logoSchema = z.object({ ...base, type: z.literal("logo") });

export const videoMarkerSchema = z.object({
  ...base,
  type: z.literal("videoMarker"),
  label: z.string().min(1).max(60),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
});

export const overlayElementSchema = z.discriminatedUnion("type", [
  telemetryPanelSchema,
  miniMapSchema,
  gridSchema,
  crosshairSchema,
  headingIndicatorSchema,
  projectLabelSchema,
  logoSchema,
  videoMarkerSchema,
  altitudeGraphSchema,
  speedGraphSchema,
]);

export const mapMarkerSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(60),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const SINGLETON_TYPES = ["grid", "crosshair", "projectLabel", "logo", "miniMap", "telemetryPanel", "headingIndicator", "altitudeGraph", "speedGraph"] as const;

/** static elements stay below the dynamic band so "bring forward/backward" never crosses it. */
const STATIC_TYPES = new Set(["grid", "crosshair", "projectLabel", "logo"]);
const DYNAMIC_TYPES = new Set(["telemetryPanel", "miniMap", "headingIndicator", "videoMarker", "altitudeGraph", "speedGraph"]);

export const overlayConfigSchema = z
  .object({
    version: z.literal(1),
    template: z.enum(["minimal", "survey", "cinematic", "custom"]),
    elements: z.array(overlayElementSchema).max(40),
    mapMarkers: z.array(mapMarkerSchema).max(20),
    units: z.object({
      speed: z.enum(["m/s", "km/h", "mph", "kn"]),
      altitude: z.enum(["m", "ft"]),
      coordinates: z.enum(["decimal", "dms"]),
    }),
    altitudeSource: z.enum(["relative", "absolute"]),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .superRefine((cfg, ctx) => {
    const seenSingleton = new Set<string>();
    const seenIds = new Set<string>();
    let videoMarkerCount = 0;

    cfg.elements.forEach((el, i) => {
      if ((SINGLETON_TYPES as readonly string[]).includes(el.type)) {
        if (seenSingleton.has(el.type)) {
          ctx.addIssue({ code: "custom", message: `Duplicate singleton element "${el.type}".`, path: ["elements", i] });
        }
        seenSingleton.add(el.type);
      }

      if (seenIds.has(el.id)) {
        ctx.addIssue({ code: "custom", message: `Duplicate element id "${el.id}".`, path: ["elements", i, "id"] });
      }
      seenIds.add(el.id);

      if (el.type === "videoMarker") {
        videoMarkerCount++;
        if (el.endTime < el.startTime) {
          ctx.addIssue({ code: "custom", message: "Video marker endTime must be >= startTime.", path: ["elements", i, "endTime"] });
        }
      }

      if (el.x + el.width > 1 + 1e-6) {
        ctx.addIssue({ code: "custom", message: "Element extends past the right edge of the frame.", path: ["elements", i, "width"] });
      }
      if (el.y + el.height > 1 + 1e-6) {
        ctx.addIssue({ code: "custom", message: "Element extends past the bottom edge of the frame.", path: ["elements", i, "height"] });
      }

      if (STATIC_TYPES.has(el.type) && el.zIndex >= 100) {
        ctx.addIssue({ code: "custom", message: `Static element "${el.type}" must have zIndex < 100.`, path: ["elements", i, "zIndex"] });
      }
      if (DYNAMIC_TYPES.has(el.type) && el.zIndex < 100) {
        ctx.addIssue({ code: "custom", message: `Dynamic element "${el.type}" must have zIndex >= 100.`, path: ["elements", i, "zIndex"] });
      }
    });

    if (videoMarkerCount > 20) {
      ctx.addIssue({ code: "custom", message: "At most 20 video markers are allowed.", path: ["elements"] });
    }
  });

export type OverlayConfig = z.infer<typeof overlayConfigSchema>;
export type OverlayElement = z.infer<typeof overlayElementSchema>;
export type MapMarker = z.infer<typeof mapMarkerSchema>;
export type TelemetryPanelElement = z.infer<typeof telemetryPanelSchema>;
export type MiniMapElement = z.infer<typeof miniMapSchema>;
export type GridElement = z.infer<typeof gridSchema>;
export type CrosshairElement = z.infer<typeof crosshairSchema>;
export type HeadingIndicatorElement = z.infer<typeof headingIndicatorSchema>;
export type ProjectLabelElement = z.infer<typeof projectLabelSchema>;
export type LogoElement = z.infer<typeof logoSchema>;
export type VideoMarkerElement = z.infer<typeof videoMarkerSchema>;
export type AltitudeGraphElement = z.infer<typeof altitudeGraphSchema>;
export type SpeedGraphElement = z.infer<typeof speedGraphSchema>;
export type GraphElement = AltitudeGraphElement | SpeedGraphElement;

/** style summary for the diagnostics/debug view. The stored format is still the element list above. */
export function summarizeConfig(cfg: OverlayConfig): Record<string, unknown> {
  const byType = new Map(cfg.elements.map((el) => [el.type, el]));
  const panel = byType.get("telemetryPanel") as TelemetryPanelElement | undefined;
  const map = byType.get("miniMap") as MiniMapElement | undefined;
  const grid = byType.get("grid") as GridElement | undefined;
  const crosshair = byType.get("crosshair") as CrosshairElement | undefined;
  const label = byType.get("projectLabel") as ProjectLabelElement | undefined;
  const logo = byType.get("logo") as LogoElement | undefined;

  return {
    template: cfg.template,
    telemetry: panel && { visible: panel.visible, position: { x: panel.x, y: panel.y }, fields: panel.fields },
    map: map && {
      visible: map.visible,
      position: { x: map.x, y: map.y },
      size: { width: map.width, height: map.height },
      showPath: map.showPath,
      showHeading: map.showHeading,
    },
    grid: grid && { visible: grid.visible, style: grid.style },
    crosshair: crosshair && { visible: crosshair.visible },
    branding: { projectLabel: label?.visible ?? false, logo: logo?.visible ?? false },
  };
}
