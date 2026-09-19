"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { FlightMap, type FlightMapHandle } from "@/components/map/FlightMap";
import { MapStyleToggle } from "@/components/map/MapStyleToggle";
import type { OverlayStageHandle } from "@/components/overlay/OverlayStage";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TelemetryInspector } from "@/components/telemetry/TelemetryInspector";
import { TelemetryTable } from "@/components/telemetry/TelemetryTable";
import { VideoStage } from "@/components/video/VideoStage";
import { useVideoClock, type TickReason } from "@/components/video/useVideoClock";
import { useBasemap } from "@/hooks/use-basemap";
import { useLogoImage } from "@/hooks/use-logo-image";
import { useFlightPath } from "@/hooks/use-flight-path";
import { useTelemetry } from "@/hooks/use-telemetry";
import { buildProfile } from "@/lib/telemetry/profile";
import { buildFrameState } from "@/lib/overlay/frame-state";
import { unitOf } from "@/lib/overlay/layout";
import type { MiniMapElement, OverlayElement } from "@/lib/overlay/model";
import type { RenderContext } from "@/lib/overlay/render";
import type { TemplateId } from "@/lib/overlay/templates";
import { createInterpolator } from "@/lib/telemetry/interpolator";
import type { PublicConfig } from "@/lib/config/public-config.server";
import { EditorStoreContext, useEditorStore, useEditorStoreRef } from "@/stores/editor-store";
import { PlaybackStoreContext, usePlaybackStoreRef } from "@/stores/playback-store";
import type { ProjectDto } from "@/types/api";
import { AddMarkerPopover } from "./AddMarkerPopover";
import { ElementSettingsPanel } from "./ElementSettingsPanel";
import { ElementsPanel } from "./ElementsPanel";
import { SyncPanel } from "./SyncPanel";
import { Timeline } from "./Timeline";
import { TelemetryReadout } from "./TelemetryReadout";
import { TelemetrySettingsPanel } from "./TelemetrySettingsPanel";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable) return true;
  // Panel form controls (sliders, toggle groups, selects) also use arrow keys — a slider thumb isn't
  // an <input>, but consuming arrow keys there must not simultaneously nudge the selected element.
  return el.closest("aside") !== null;
}

const SAVE_LABEL: Record<string, { icon: typeof CircleCheck; text: string; className: string }> = {
  saved: { icon: CircleCheck, text: "Saved", className: "text-success" },
  dirty: { icon: LoaderCircle, text: "Unsaved changes", className: "text-muted-foreground" },
  saving: { icon: LoaderCircle, text: "Saving…", className: "text-muted-foreground" },
  error: { icon: CircleAlert, text: "Save failed", className: "text-destructive" },
};

function ExportVideoButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const flush = useEditorStore((s) => s.flush);
  const [navigating, setNavigating] = useState(false);

  return (
    <Button
      size="sm"
      className="h-7"
      disabled={navigating}
      onClick={() => {
        setNavigating(true);
        void flush().finally(() => router.push(`/projects/${projectId}/export`));
      }}
    >
      Export Video
    </Button>
  );
}

function SaveStateBadge() {
  const saveState = useEditorStore((s) => s.saveState);
  const flush = useEditorStore((s) => s.flush);
  const { icon: Icon, text, className } = SAVE_LABEL[saveState];
  return (
    <div className={`flex items-center gap-1.5 text-xs ${className}`}>
      <Icon className={`size-3.5 ${saveState === "saving" ? "animate-spin" : ""}`} aria-hidden="true" />
      {text}
      {saveState === "error" && (
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => void flush()}>
          Retry
        </Button>
      )}
    </div>
  );
}

function TemplateSelect({ hasGps, hasHeading, hasLogo }: { hasGps: boolean; hasHeading: boolean; hasLogo: boolean }) {
  const template = useEditorStore((s) => s.config.template);
  const applyTemplate = useEditorStore((s) => s.applyTemplate);
  return (
    <Select value={template} onValueChange={(v) => applyTemplate(v as TemplateId, { hasGps, hasHeading, hasLogo })}>
      <SelectTrigger className="h-7 w-36 text-xs" aria-label="Template">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="minimal">Minimal</SelectItem>
        <SelectItem value="survey">Survey</SelectItem>
        <SelectItem value="cinematic">Cinematic</SelectItem>
        {template === "custom" && <SelectItem value="custom">Custom</SelectItem>}
      </SelectContent>
    </Select>
  );
}

function EditorBody({ project, publicConfig }: { project: ProjectDto; publicConfig: PublicConfig }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const flightMapRef = useRef<FlightMapHandle>(null);
  const overlayStageRef = useRef<OverlayStageHandle>(null);
  const playbackStore = usePlaybackStoreRef();
  const mapMode = useEditorStore((s) => s.mapMode);
  const setMapMode = useEditorStore((s) => s.setMapMode);
  const offsetSec = useEditorStore((s) => s.telemetrySettings.offsetSec);
  const speedSource = useEditorStore((s) => s.telemetrySettings.speedSource);
  const headingFallback = useEditorStore((s) => s.telemetrySettings.headingFallback);
  const coordinateOrder = useEditorStore((s) => s.telemetrySettings.coordinateOrder);
  const syncReport = useEditorStore((s) => s.syncReport);
  const saveState = useEditorStore((s) => s.saveState);
  const config = useEditorStore((s) => s.config);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const setVisible = useEditorStore((s) => s.setVisible);
  const updateElement = useEditorStore((s) => s.updateElement<OverlayElement>);
  const removeElement = useEditorStore((s) => s.removeElement);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const addMarkerMode = useEditorStore((s) => s.addMarkerMode);
  const setPendingMarker = useEditorStore((s) => s.setPendingMarker);
  const [drawerTab, setDrawerTab] = useState("map");
  // Force the Flight map tab open while placing a map marker, without a setState-in-effect.
  const effectiveDrawerTab = addMarkerMode === "map" ? "map" : drawerTab;

  const { data: telemetry } = useTelemetry(project.id);
  const { data: flightPath } = useFlightPath(project.id);

  const interpolator = useMemo(() => (telemetry ? createInterpolator(telemetry.series) : null), [telemetry]);
  const profile = useMemo(() => (telemetry ? buildProfile(telemetry.series) : null), [telemetry]);
  const videoMetadata = project.videoMetadata;
  const capabilities = project.telemetrySummary?.capabilities;
  const hasGps = capabilities?.gps ?? false;
  const hasHeading = capabilities?.heading === "srt" || headingFallback === "gps-course";
  const hasLogo = useEditorStore((s) => s.hasLogo);
  const logoVersion = useEditorStore((s) => s.logoVersion);
  const projectName = useEditorStore((s) => s.projectName);
  const companyName = useEditorStore((s) => s.companyName);
  const logoImage = useLogoImage(project.id, hasLogo, logoVersion);
  const durationSec = videoMetadata?.video.durationSec ?? 0;
  const fps = videoMetadata?.video.fps.value ?? 30;
  const vw = videoMetadata?.video.width ?? 1920;
  const vh = videoMetadata?.video.height ?? 1080;

  const miniMap = config.elements.find((el): el is MiniMapElement => el.type === "miniMap");
  const basemapWidthPx = miniMap ? Math.min(1024, Math.max(256, Math.round(miniMap.width * vw))) : 256;
  const basemapAspect = miniMap ? miniMap.width / miniMap.height : 1;
  const basemap = useBasemap(project.id, miniMap?.basemap ?? "none", basemapAspect, basemapWidthPx, miniMap?.paddingRatio ?? 0.12);

  const rc: RenderContext = useMemo(
    () => ({
      frameWidth: vw,
      frameHeight: vh,
      unit: unitOf({ width: vw, height: vh }),
      config,
      branding: { projectName, companyName },
      assets: { logo: logoImage, basemap, flightPath, profile },
    }),
    [vw, vh, config, projectName, companyName, flightPath, basemap, logoImage, profile],
  );

  useVideoClock(videoRef, (videoTime, reason: TickReason) => {
    if (!interpolator || !capabilities) return;
    const frame = buildFrameState(
      videoTime,
      interpolator,
      { offsetSec, speedSource, headingFallback, coordinateOrder },
      { altitudeSource: config.altitudeSource },
      capabilities,
    );
    flightMapRef.current?.updateDrone(frame);
    overlayStageRef.current?.drawFrame(frame);
    playbackStore.getState().publish(videoTime, frame.display, reason);
  });

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as Record<string, unknown>).__dtsEditorStore = { getState: playbackStore.getState };
    return () => {
      delete (window as unknown as Record<string, unknown>).__dtsEditorStore;
    };
  }, [playbackStore]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const video = videoRef.current;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.code === "Space") {
        if (!video) return;
        e.preventDefault();
        if (video.paused) void video.play();
        else video.pause();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        const el = selectedId ? config.elements.find((c) => c.id === selectedId) : undefined;
        if (el) {
          e.preventDefault();
          const nudge = e.shiftKey ? 0.02 : 0.002;
          const dx = e.key === "ArrowLeft" ? -nudge : e.key === "ArrowRight" ? nudge : 0;
          const dy = e.key === "ArrowUp" ? -nudge : e.key === "ArrowDown" ? nudge : 0;
          updateElement(selectedId!, { x: el.x + dx, y: el.y + dy });
          return;
        }
        if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && video) {
          e.preventDefault();
          const dir = e.key === "ArrowLeft" ? -1 : 1;
          const step = e.shiftKey ? 1 : 1 / fps;
          video.pause();
          video.currentTime = Math.min(durationSec, Math.max(0, video.currentTime + dir * step));
        }
        return;
      }
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur();
        select(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        removeElement(selectedId);
        return;
      }
      if (e.key.toLowerCase() === "m") {
        const el = config.elements.find((c) => c.type === "miniMap");
        if (el) setVisible(el.id, !el.visible);
        return;
      }
      if (e.key.toLowerCase() === "g") {
        const el = config.elements.find((c) => c.type === "grid");
        if (el) setVisible(el.id, !el.visible);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fps, durationSec, selectedId, config, updateElement, removeElement, select, setVisible, undo, redo]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (saveState === "dirty" || saveState === "saving") e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  if (!videoMetadata || !capabilities) return null;

  return (
    <PlaybackStoreContext.Provider value={playbackStore}>
      {/* the editor requires >= 1024px; narrower viewports get a notice instead of a cramped layout. */}
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center p-6 text-center lg:hidden">
        <p className="text-sm text-muted-foreground">The editor requires a screen at least 1024px wide. Please widen your window.</p>
      </div>

      <div className="hidden h-[calc(100vh-3rem)] flex-col overflow-hidden lg:flex">
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-card px-4">
          <TemplateSelect hasGps={hasGps} hasHeading={hasHeading} hasLogo={hasLogo} />
          <div className="flex items-center gap-3">
            <SaveStateBadge />
            <ExportVideoButton projectId={project.id} />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-card">
            <ElementsPanel projectId={project.id} hasHeading={hasHeading} hasLogo={hasLogo} />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              <VideoStage
                ref={videoRef}
                projectId={project.id}
                videoMetadata={videoMetadata}
                overlay={{ rc, stageRef: overlayStageRef }}
                onVideoClick={addMarkerMode === "video" ? (at) => setPendingMarker({ kind: "video", at }) : undefined}
              />
              <AddMarkerPopover />
            </div>
            <Timeline videoRef={videoRef} durationSec={durationSec} fps={fps} series={telemetry?.series ?? null} offsetSec={offsetSec} />

            <div className="h-[300px] shrink-0 overflow-hidden border-t border-border">
              <Tabs value={effectiveDrawerTab} onValueChange={setDrawerTab} className="flex h-full flex-col gap-0">
                <TabsList className="shrink-0 rounded-none border-b border-border bg-card px-2">
                  <TabsTrigger value="map">Flight map</TabsTrigger>
                  <TabsTrigger value="telemetry" disabled={!telemetry}>
                    Telemetry
                  </TabsTrigger>
                  <TabsTrigger value="sync">Sync</TabsTrigger>
                  <TabsTrigger value="inspector" disabled={!telemetry}>
                    Inspector
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="map" className="min-h-0 flex-1 p-0">
                  <div className="relative h-full">
                    <FlightMap
                      ref={flightMapRef}
                      publicConfig={publicConfig}
                      flightPath={flightPath}
                      mapMarkers={config.mapMarkers}
                      mode={mapMode}
                      accentColor={config.accentColor}
                      className="h-full"
                      onMapClick={addMarkerMode === "map" ? (lngLat) => setPendingMarker({ kind: "map", lngLat }) : undefined}
                    />
                    <AddMarkerPopover />
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                      <MapStyleToggle mode={mapMode} onModeChange={setMapMode} />
                      <Button variant="outline" size="sm" onClick={() => flightMapRef.current?.fitToPath()}>
                        Fit route
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="telemetry" className="min-h-0 flex-1 overflow-y-auto p-3">
                  {telemetry && (
                    <div className="flex flex-col gap-3">
                      <TelemetryReadout
                        offsetSec={offsetSec}
                        altitudeUnit={config.units.altitude}
                        speedUnit={config.units.speed}
                        coordinateFormat={config.units.coordinates}
                      />
                      <TelemetryTable series={telemetry.series} />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sync" className="min-h-0 flex-1 overflow-y-auto p-3">
                  <SyncPanel fps={fps} syncReport={syncReport} />
                </TabsContent>

                <TabsContent value="inspector" className="min-h-0 flex-1 overflow-y-auto p-3">
                  {telemetry && <TelemetryInspector summary={telemetry.summary} />}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-card">
            {selectedId ? <ElementSettingsPanel publicConfig={publicConfig} /> : <TelemetrySettingsPanel />}
          </aside>
        </div>
      </div>
    </PlaybackStoreContext.Provider>
  );
}

export function EditorShell({ project, publicConfig }: { project: ProjectDto; publicConfig: PublicConfig }) {
  const frame = { width: project.videoMetadata?.video.width ?? 1920, height: project.videoMetadata?.video.height ?? 1080 };
  const editorStore = useEditorStoreRef(project.id, {
    frame,
    durationSec: project.videoMetadata?.video.durationSec ?? 0,
    telemetrySettings: project.telemetrySettings,
    config: project.overlayConfig,
    syncReport: project.syncReport,
    projectName: project.name,
    companyName: project.companyName,
    hasLogo: project.files.logo !== null,
  });

  return (
    <EditorStoreContext.Provider value={editorStore}>
      <EditorBody project={project} publicConfig={publicConfig} />
    </EditorStoreContext.Provider>
  );
}
