"use client";

import { Map as MapIcon, Satellite } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function MapStyleToggle({ mode, onModeChange }: { mode: "map" | "satellite"; onModeChange: (mode: "map" | "satellite") => void }) {
  return (
    <ToggleGroup type="single" value={mode} onValueChange={(v) => v && onModeChange(v as "map" | "satellite")} variant="outline" size="sm" className="bg-card">
      <ToggleGroupItem value="map" aria-label="Map style">
        <MapIcon className="size-3.5" aria-hidden="true" />
        Map
      </ToggleGroupItem>
      <ToggleGroupItem value="satellite" aria-label="Satellite style">
        <Satellite className="size-3.5" aria-hidden="true" />
        Satellite
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
