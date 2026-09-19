"use client";

import { MapPin, Trash, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VideoMarkerElement } from "@/lib/overlay/model";
import { useEditorStore } from "@/stores/editor-store";

export function MarkersSection() {
  const config = useEditorStore((s) => s.config);
  const addMarkerMode = useEditorStore((s) => s.addMarkerMode);
  const setAddMarkerMode = useEditorStore((s) => s.setAddMarkerMode);
  const removeMapMarker = useEditorStore((s) => s.removeMapMarker);
  const removeElement = useEditorStore((s) => s.removeElement);
  const select = useEditorStore((s) => s.select);

  const videoMarkers = config.elements.filter((el): el is VideoMarkerElement => el.type === "videoMarker");

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-foreground">Markers</h2>

      <div className="flex gap-2">
        <Button
          variant={addMarkerMode === "map" ? "default" : "outline"}
          size="sm"
          className="h-7 flex-1"
          onClick={() => setAddMarkerMode(addMarkerMode === "map" ? "none" : "map")}
        >
          <MapPin className="size-3.5" aria-hidden="true" />
          Map marker
        </Button>
        <Button
          variant={addMarkerMode === "video" ? "default" : "outline"}
          size="sm"
          className="h-7 flex-1"
          onClick={() => setAddMarkerMode(addMarkerMode === "video" ? "none" : "video")}
        >
          <Video className="size-3.5" aria-hidden="true" />
          Video marker
        </Button>
      </div>
      {addMarkerMode !== "none" && (
        <p className="text-xs text-muted-foreground">
          Click the {addMarkerMode === "map" ? "flight map" : "video"} to place it, or{" "}
          <button type="button" className="underline" onClick={() => setAddMarkerMode("none")}>
            cancel
          </button>
          .
        </p>
      )}

      {(config.mapMarkers.length > 0 || videoMarkers.length > 0) && (
        <ul className="flex flex-col gap-1">
          {config.mapMarkers.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs text-foreground hover:bg-accent/30">
              <span className="flex items-center gap-1.5 truncate">
                <MapPin className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                {m.label}
              </span>
              <button type="button" onClick={() => removeMapMarker(m.id)} aria-label={`Remove ${m.label}`} className="shrink-0 text-muted-foreground hover:text-destructive">
                <Trash className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
          {videoMarkers.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs text-foreground hover:bg-accent/30">
              <button type="button" className="flex min-w-0 items-center gap-1.5 truncate text-left" onClick={() => select(m.id)}>
                <Video className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{m.label}</span>
              </button>
              <button type="button" onClick={() => removeElement(m.id)} aria-label={`Remove ${m.label}`} className="shrink-0 text-muted-foreground hover:text-destructive">
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
