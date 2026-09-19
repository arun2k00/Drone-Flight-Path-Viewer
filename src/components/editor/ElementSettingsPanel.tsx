"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import type { PublicConfig } from "@/lib/config/public-config.server";
import { resizeAboutCenter, unitOf, type Corner } from "@/lib/overlay/layout";
import type { CrosshairElement, GridElement, MiniMapElement, OverlayElement, ProjectLabelElement, TelemetryPanelElement, VideoMarkerElement, GraphElement } from "@/lib/overlay/model";
import { useEditorStore } from "@/stores/editor-store";
import { usePlaybackStore } from "@/stores/playback-store";

const TYPE_LABELS: Record<string, string> = {
  telemetryPanel: "Telemetry panel",
  miniMap: "Mini map",
  headingIndicator: "Heading indicator",
  grid: "Grid",
  crosshair: "Crosshair",
  projectLabel: "Project label",
  logo: "Logo",
  videoMarker: "Video marker",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ id, label, checked, onCheckedChange }: { id: string; label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
      <Label htmlFor={id} className="cursor-pointer text-foreground">
        {label}
      </Label>
    </div>
  );
}

function MiniMapSettings({ el, publicConfig }: { el: MiniMapElement; publicConfig: PublicConfig }) {
  const updateMiniMap = useEditorStore((s) => s.updateElement<MiniMapElement>);
  const patch = (p: Partial<MiniMapElement>) => updateMiniMap(el.id, p);

  const basemapDisabled = (style: "map" | "satellite") => !publicConfig.overlayBasemaps[style];

  return (
    <>
      <div>
        <Toggle id="mm-progress" label="Progress" checked={el.showProgress} onCheckedChange={(v) => patch({ showProgress: v })} />
        <Toggle id="mm-startend" label="Start / End" checked={el.showStartEnd} onCheckedChange={(v) => patch({ showStartEnd: v })} />
        <Toggle id="mm-heading" label="Heading arrow" checked={el.showHeading} onCheckedChange={(v) => patch({ showHeading: v })} />
        <Toggle id="mm-north" label="North arrow" checked={el.showNorthArrow} onCheckedChange={(v) => patch({ showNorthArrow: v })} />
        <Toggle id="mm-scale" label="Scale bar" checked={el.showScaleBar} onCheckedChange={(v) => patch({ showScaleBar: v })} />
        <Toggle id="mm-markers" label="Markers" checked={el.showMarkers} onCheckedChange={(v) => patch({ showMarkers: v })} />
      </div>

      <Field label="Basemap">
        <Select value={el.basemap} onValueChange={(v) => patch({ basemap: v as MiniMapElement["basemap"] })}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="map" disabled={basemapDisabled("map")}>
              Map
            </SelectItem>
            <SelectItem value="satellite" disabled={basemapDisabled("satellite")}>
              Satellite
            </SelectItem>
          </SelectContent>
        </Select>
        {(basemapDisabled("map") || basemapDisabled("satellite")) && (
          <p className="text-xs text-muted-foreground">No tile provider configured for burned-in maps (see OVERLAY_MAP_TILE_URL).</p>
        )}
      </Field>

      <Field label="Padding">
        <Slider min={0} max={0.3} step={0.01} value={[el.paddingRatio]} onValueChange={([v]) => patch({ paddingRatio: v })} />
      </Field>
    </>
  );
}

function GridSettings({ el }: { el: GridElement }) {
  const updateGrid = useEditorStore((s) => s.updateElement<GridElement>);
  const patch = (p: Partial<GridElement>) => updateGrid(el.id, p);

  return (
    <>
      <Field label="Style">
        <ToggleGroup type="single" variant="outline" size="sm" value={el.style} onValueChange={(v) => v && patch({ style: v as GridElement["style"] })}>
          <ToggleGroupItem value="lines">Lines</ToggleGroupItem>
          <ToggleGroupItem value="dotted">Dotted</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <Field label={`Cell size — ${el.cellSize}px`}>
        <Slider min={20} max={600} step={10} value={[el.cellSize]} onValueChange={([v]) => patch({ cellSize: v })} />
      </Field>
      <Field label={`Line width — ${el.lineWidth}px`}>
        <Slider min={0.5} max={6} step={0.5} value={[el.lineWidth]} onValueChange={([v]) => patch({ lineWidth: v })} />
      </Field>
      <Field label={`Major every — ${el.majorEvery === 0 ? "off" : el.majorEvery}`}>
        <Slider min={0} max={20} step={1} value={[el.majorEvery]} onValueChange={([v]) => patch({ majorEvery: v })} />
      </Field>
    </>
  );
}

function CrosshairSettings({ el }: { el: CrosshairElement }) {
  const frame = useEditorStore((s) => s.frame);
  const updateCrosshair = useEditorStore((s) => s.updateElement<CrosshairElement>);
  const patch = (p: Partial<CrosshairElement>) => updateCrosshair(el.id, p);

  function handleSizeChange(size: number) {
    const u = unitOf(frame);
    const side = size + 8;
    const widthNorm = Math.min(1, (side * u) / frame.width);
    const heightNorm = Math.min(1, (side * u) / frame.height);
    const resized = resizeAboutCenter(el, widthNorm, heightNorm, frame);
    updateCrosshair(el.id, { size, x: resized.x, y: resized.y, width: resized.width, height: resized.height });
  }

  return (
    <>
      <Field label={`Size — ${el.size}px`}>
        <Slider min={16} max={400} step={4} value={[el.size]} onValueChange={([v]) => handleSizeChange(v)} />
      </Field>
      <Field label={`Line width — ${el.lineWidth}px`}>
        <Slider min={0.5} max={8} step={0.5} value={[el.lineWidth]} onValueChange={([v]) => patch({ lineWidth: v })} />
      </Field>
      <Field label={`Gap — ${el.gap}px`}>
        <Slider min={0} max={100} step={2} value={[el.gap]} onValueChange={([v]) => patch({ gap: v })} />
      </Field>
      <Toggle id="ch-center-dot" label="Centre dot" checked={el.showCenterDot} onCheckedChange={(v) => patch({ showCenterDot: v })} />
    </>
  );
}

function ProjectLabelSettings({ el }: { el: ProjectLabelElement }) {
  const updateLabel = useEditorStore((s) => s.updateElement<ProjectLabelElement>);
  const patch = (p: Partial<ProjectLabelElement>) => updateLabel(el.id, p);

  return (
    <>
      <Field label="Caption">
        <Input value={el.caption} maxLength={40} onChange={(e) => patch({ caption: e.target.value })} className="h-8" />
      </Field>
      <Toggle id="pl-show-company" label="Show company" checked={el.showCompany} onCheckedChange={(v) => patch({ showCompany: v })} />
      <Field label="Background">
        <Select value={el.background} onValueChange={(v) => patch({ background: v as ProjectLabelElement["background"] })}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="panel">Panel</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}

function VideoMarkerSettings({ el }: { el: VideoMarkerElement }) {
  const updateMarker = useEditorStore((s) => s.updateElement<VideoMarkerElement>);
  const videoTime = usePlaybackStore((s) => s.videoTime);
  const patch = (p: Partial<VideoMarkerElement>) => updateMarker(el.id, p);

  return (
    <>
      <Field label="Label">
        <Input value={el.label} maxLength={60} onChange={(e) => patch({ label: e.target.value })} className="h-8" />
      </Field>
      <Field label={`Start time — ${el.startTime.toFixed(1)}s`}>
        <div className="flex items-center gap-2">
          <Slider min={0} max={Math.max(el.endTime, el.startTime)} step={0.1} value={[el.startTime]} onValueChange={([v]) => patch({ startTime: Math.min(v, el.endTime) })} />
          <Button variant="outline" size="sm" className="h-7 shrink-0" onClick={() => patch({ startTime: Math.min(videoTime, el.endTime) })}>
            Set current
          </Button>
        </div>
      </Field>
      <Field label={`End time — ${el.endTime.toFixed(1)}s`}>
        <div className="flex items-center gap-2">
          <Slider min={el.startTime} max={Math.max(el.startTime + 60, el.endTime)} step={0.1} value={[el.endTime]} onValueChange={([v]) => patch({ endTime: Math.max(v, el.startTime) })} />
          <Button variant="outline" size="sm" className="h-7 shrink-0" onClick={() => patch({ endTime: Math.max(videoTime, el.startTime) })}>
            Set current
          </Button>
        </div>
      </Field>
    </>
  );
}

function GeometryFields({ el }: { el: OverlayElement }) {
  const updateElement = useEditorStore((s) => s.updateElement<OverlayElement>);
  const patch = (p: Partial<OverlayElement>) => updateElement(el.id, p);
  const pct = (v: number) => Math.round(v * 1000) / 10;

  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="X %">
        <Input type="number" step={0.1} value={pct(el.x)} onChange={(e) => patch({ x: Number(e.target.value) / 100 })} className="h-8" />
      </Field>
      <Field label="Y %">
        <Input type="number" step={0.1} value={pct(el.y)} onChange={(e) => patch({ y: Number(e.target.value) / 100 })} className="h-8" />
      </Field>
      <Field label="W %">
        <Input type="number" step={0.1} value={pct(el.width)} onChange={(e) => patch({ width: Number(e.target.value) / 100 })} className="h-8" />
      </Field>
      <Field label="H %">
        <Input type="number" step={0.1} value={pct(el.height)} onChange={(e) => patch({ height: Number(e.target.value) / 100 })} className="h-8" />
      </Field>
    </div>
  );
}

function OpacityField({ el }: { el: OverlayElement }) {
  const updateElement = useEditorStore((s) => s.updateElement<OverlayElement>);
  return (
    <Field label={`Opacity — ${Math.round(el.opacity * 100)}%`}>
      <Slider min={0} max={1} step={0.01} value={[el.opacity]} onValueChange={([v]) => updateElement(el.id, { opacity: v })} />
    </Field>
  );
}

function OrderButtons({ id }: { id: string }) {
  const bringForward = useEditorStore((s) => s.bringForward);
  const bringBackward = useEditorStore((s) => s.bringBackward);
  return (
    <Field label="Layer">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-7 flex-1" onClick={() => bringBackward(id)}>
          Backward
        </Button>
        <Button variant="outline" size="sm" className="h-7 flex-1" onClick={() => bringForward(id)}>
          Forward
        </Button>
      </div>
    </Field>
  );
}

export function ElementSettingsPanel({ publicConfig }: { publicConfig: PublicConfig }) {
  const selectedId = useEditorStore((s) => s.selectedId);
  const config = useEditorStore((s) => s.config);
  const setPosition = useEditorStore((s) => s.setPosition);
  const select = useEditorStore((s) => s.select);

  const el = config.elements.find((e) => e.id === selectedId);
  if (!el) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{TYPE_LABELS[el.type] ?? el.type}</h2>
        <Button variant="ghost" size="sm" onClick={() => select(null)}>
          Done
        </Button>
      </div>

      {el.type !== "grid" && (
        <>
          <Field label="Position">
            <ToggleGroup type="single" variant="outline" size="sm" onValueChange={(v) => v && setPosition(el.id, v as Corner)}>
              <ToggleGroupItem value="tl">TL</ToggleGroupItem>
              <ToggleGroupItem value="tr">TR</ToggleGroupItem>
              <ToggleGroupItem value="bl">BL</ToggleGroupItem>
              <ToggleGroupItem value="br">BR</ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <GeometryFields el={el} />
        </>
      )}

      <OpacityField el={el} />
      <OrderButtons id={el.id} />

      {el.type === "miniMap" && <MiniMapSettings el={el} publicConfig={publicConfig} />}

      {(el.type === "telemetryPanel" || el.type === "altitudeGraph" || el.type === "speedGraph") && <TelemetryPanelBackgroundSettings el={el} />}

      {el.type === "grid" && <GridSettings el={el} />}
      {el.type === "crosshair" && <CrosshairSettings el={el} />}
      {el.type === "projectLabel" && <ProjectLabelSettings el={el} />}
      {el.type === "videoMarker" && <VideoMarkerSettings el={el} />}
    </div>
  );
}

function TelemetryPanelBackgroundSettings({ el }: { el: TelemetryPanelElement | GraphElement }) {
  const updatePanel = useEditorStore((s) => s.updateElement<TelemetryPanelElement>);

  return (
    <>
      <Field label="Background">
        <Select value={el.background} onValueChange={(v) => updatePanel(el.id, { background: v as TelemetryPanelElement["background"] })}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="panel">Panel</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {el.background === "panel" && (
        <Field label="Background opacity">
          <Slider min={0} max={1} step={0.02} value={[el.backgroundOpacity]} onValueChange={([v]) => updatePanel(el.id, { backgroundOpacity: v })} />
        </Field>
      )}
    </>
  );
}
