"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { GridElement, LogoElement, MiniMapElement, ProjectLabelElement, TelemetryPanelElement } from "@/lib/overlay/model";
import { useEditorStore } from "@/stores/editor-store";
import { BrandingPanel } from "./BrandingPanel";
import { MarkersSection } from "./MarkersSection";

const FIELD_LABELS: Record<keyof TelemetryPanelElement["fields"], string> = {
  altitude: "Altitude",
  speed: "Speed",
  coordinates: "Coordinates",
  heading: "Heading",
  time: "Time",
};

function Row({
  id,
  label,
  checked,
  onCheckedChange,
  onSelectName,
  selected,
  indent = false,
  disabled = false,
  disabledReason,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  onSelectName?: () => void;
  selected?: boolean;
  indent?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const row = (
    <div className={`flex items-center gap-2 rounded py-1 ${indent ? "pl-6" : ""} ${selected ? "bg-accent/40" : ""}`}>
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(v) => onCheckedChange(v === true)} />
      {onSelectName ? (
        <button
          type="button"
          onClick={onSelectName}
          disabled={disabled}
          className="cursor-pointer text-left text-foreground hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {label}
        </button>
      ) : (
        <Label htmlFor={id} className={`cursor-pointer ${disabled ? "text-muted-foreground" : "text-foreground"}`}>
          {label}
        </Label>
      )}
    </div>
  );

  if (!disabled || !disabledReason) return row;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  );
}

export function ElementsPanel({ projectId, hasHeading, hasLogo }: { projectId: string; hasHeading: boolean; hasLogo: boolean }) {
  const config = useEditorStore((s) => s.config);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const setVisible = useEditorStore((s) => s.setVisible);
  const updateElement = useEditorStore((s) => s.updateElement<TelemetryPanelElement>);
  const updateMiniMap = useEditorStore((s) => s.updateElement<MiniMapElement>);
  const updateGrid = useEditorStore((s) => s.updateElement<GridElement>);

  const panel = config.elements.find((el): el is TelemetryPanelElement => el.type === "telemetryPanel");
  const miniMap = config.elements.find((el): el is MiniMapElement => el.type === "miniMap");
  const headingIndicator = config.elements.find((el) => el.type === "headingIndicator");
  const grid = config.elements.find((el): el is GridElement => el.type === "grid");
  const crosshair = config.elements.find((el) => el.type === "crosshair");
  const projectLabel = config.elements.find((el): el is ProjectLabelElement => el.type === "projectLabel");
  const logo = config.elements.find((el): el is LogoElement => el.type === "logo");
  const graphs = config.elements.filter((el) => el.type === "altitudeGraph" || el.type === "speedGraph");

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold text-foreground">Overlay elements</h2>

      {panel && (
        <div>
          <Row
            id="el-telemetryPanel"
            label="Telemetry"
            checked={panel.visible}
            onCheckedChange={(v) => setVisible("telemetryPanel", v)}
            onSelectName={() => select("telemetryPanel")}
            selected={selectedId === "telemetryPanel"}
          />
          {panel.visible && (
            <div className="flex flex-col">
              {(Object.keys(FIELD_LABELS) as (keyof TelemetryPanelElement["fields"])[]).map((field) => (
                <Row
                  key={field}
                  id={`el-telemetryPanel-${field}`}
                  label={FIELD_LABELS[field]}
                  checked={panel.fields[field]}
                  onCheckedChange={(v) => updateElement("telemetryPanel", { fields: { ...panel.fields, [field]: v } })}
                  indent
                />
              ))}
            </div>
          )}
        </div>
      )}

      {miniMap && (
        <div>
          <Row
            id="el-miniMap"
            label="Mini map"
            checked={miniMap.visible}
            onCheckedChange={(v) => setVisible("miniMap", v)}
            onSelectName={() => select("miniMap")}
            selected={selectedId === "miniMap"}
          />
          <Row
            id="el-miniMap-showPath"
            label="Flight path"
            checked={miniMap.showPath}
            onCheckedChange={(v) => updateMiniMap("miniMap", { showPath: v })}
            disabled={!miniMap.visible}
            disabledReason="Turn on Mini map first."
            indent
          />
        </div>
      )}

      {headingIndicator && (
        <Row
          id="el-headingIndicator"
          label="Heading indicator"
          checked={headingIndicator.visible}
          onCheckedChange={(v) => setVisible("headingIndicator", v)}
          onSelectName={() => select("headingIndicator")}
          selected={selectedId === "headingIndicator"}
          disabled={!hasHeading}
          disabledReason="Heading isn't recorded in this SRT."
        />
      )}

      {graphs.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Graph widgets</p>
          {graphs.map((g) => (
            <Row
              key={g.id}
              id={`el-${g.id}`}
              label={g.type === "altitudeGraph" ? "Altitude graph" : "Speed graph"}
              checked={g.visible}
              onCheckedChange={(v) => setVisible(g.id, v)}
              onSelectName={() => select(g.id)}
              selected={selectedId === g.id}
            />
          ))}
        </div>
      )}

      {grid && (
        <div>
          <Row
            id="el-grid"
            label="Grid"
            checked={grid.visible}
            onCheckedChange={(v) => setVisible("grid", v)}
            onSelectName={() => select("grid")}
            selected={selectedId === "grid"}
          />
          {grid.visible && (
            <div className="pl-6">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={grid.style}
                onValueChange={(v) => v && updateGrid("grid", { style: v as GridElement["style"] })}
              >
                <ToggleGroupItem value="lines">Lines</ToggleGroupItem>
                <ToggleGroupItem value="dotted">Dotted</ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
        </div>
      )}

      {crosshair && (
        <Row
          id="el-crosshair"
          label="Crosshair"
          checked={crosshair.visible}
          onCheckedChange={(v) => setVisible("crosshair", v)}
          onSelectName={() => select("crosshair")}
          selected={selectedId === "crosshair"}
        />
      )}

      {projectLabel && (
        <Row
          id="el-projectLabel"
          label="Project label"
          checked={projectLabel.visible}
          onCheckedChange={(v) => setVisible("projectLabel", v)}
          onSelectName={() => select("projectLabel")}
          selected={selectedId === "projectLabel"}
        />
      )}

      {logo && (
        <Row
          id="el-logo"
          label="Logo"
          checked={logo.visible}
          onCheckedChange={(v) => setVisible("logo", v)}
          onSelectName={() => select("logo")}
          selected={selectedId === "logo"}
          disabled={!hasLogo}
          disabledReason="Upload a logo in Branding."
        />
      )}

      <Separator />
      <MarkersSection />
      <Separator />
      <BrandingPanel projectId={projectId} />
    </div>
  );
}
