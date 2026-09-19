import { createStore, useStore } from "zustand";
import { createContext, useContext, useState } from "react";
import { isDynamic } from "@/lib/overlay/classify";
import { clampElement, positionPreset, type Corner, type Frame } from "@/lib/overlay/layout";
import { instantiateTemplate, type TemplateContext, type TemplateId } from "@/lib/overlay/templates";
import type { MapMarker, OverlayConfig, OverlayElement, VideoMarkerElement } from "@/types/overlay";
import type { SyncReport, TelemetrySettings } from "@/types/telemetry";

const AUTOSAVE_DEBOUNCE_MS = 800;
const VIDEO_MARKER_WINDOW_SEC = 2.5;
const HISTORY_LIMIT = 50;

export type SaveState = "saved" | "dirty" | "saving" | "error";
export type AddMarkerMode = "none" | "map" | "video";
export type PendingMarker = { kind: "map"; lngLat: { lng: number; lat: number } } | { kind: "video"; at: { x: number; y: number; time: number } };

function shortId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export interface EditorState {
  projectId: string;
  frame: Frame;
  durationSec: number;
  telemetrySettings: TelemetrySettings;
  config: OverlayConfig;
  syncReport: SyncReport | null;
  mapMode: "map" | "satellite";
  saveState: SaveState;
  selectedId: string | null;
  addMarkerMode: AddMarkerMode;
  pendingMarker: PendingMarker | null;
  past: OverlayConfig[];
  future: OverlayConfig[];
  projectName: string;
  companyName: string | null;
  hasLogo: boolean;
  logoVersion: number;
  setProjectName(name: string): void;
  setCompanyName(name: string | null): void;
  setHasLogo(hasLogo: boolean): void;
  setTelemetrySettings(patch: Partial<TelemetrySettings>): void;
  setMapMode(mode: "map" | "satellite"): void;
  updateElement<T extends OverlayElement>(id: string, patch: Partial<T>): void;
  setVisible(id: string, visible: boolean): void;
  setUnits(patch: Partial<OverlayConfig["units"]>): void;
  setAltitudeSource(source: OverlayConfig["altitudeSource"]): void;
  select(id: string | null): void;
  setPosition(id: string, corner: Corner): void;
  bringForward(id: string): void;
  bringBackward(id: string): void;
  undo(): void;
  redo(): void;
  applyTemplate(id: TemplateId, ctx: TemplateContext): void;
  setAddMarkerMode(mode: AddMarkerMode): void;
  addMapMarker(lngLat: { lng: number; lat: number }, label: string): void;
  addVideoMarker(at: { x: number; y: number; time: number }, label: string): void;
  removeElement(id: string): void;
  removeMapMarker(id: string): void;
  setPendingMarker(p: PendingMarker | null): void;
  confirmPendingMarker(label: string): void;
  flush(): Promise<void>;
}

export type EditorStoreApi = ReturnType<typeof createEditorStore>;

interface PatchProjectResponse {
  project: { name: string; companyName: string | null; telemetrySettings: TelemetrySettings; overlayConfig: OverlayConfig; syncReport: SyncReport | null };
}

interface InitialEditorState {
  frame: Frame;
  durationSec: number;
  telemetrySettings: TelemetrySettings;
  config: OverlayConfig;
  syncReport: SyncReport | null;
  projectName: string;
  companyName: string | null;
  hasLogo: boolean;
}

/** Autosaves telemetrySettings and overlayConfig together, 800 ms after the last change. */
export function createEditorStore(projectId: string, initial: InitialEditorState) {
  let debounceHandle: ReturnType<typeof setTimeout> | null = null;
  let pendingTelemetryPatch: Partial<TelemetrySettings> = {};
  let pendingProjectPatch: { name?: string; companyName?: string | null } = {};
  let configDirty = false;

  const store = createStore<EditorState>((set, get) => {
    const scheduleSave = () => {
      set({ saveState: "dirty" });
      if (debounceHandle) clearTimeout(debounceHandle);
      debounceHandle = setTimeout(() => {
        void get().flush();
      }, AUTOSAVE_DEBOUNCE_MS);
    };

    const updateConfig = (updater: (config: OverlayConfig) => OverlayConfig) => {
      set((s) => ({
        config: updater(s.config),
        past: [...s.past, s.config].slice(-HISTORY_LIMIT),
        future: [],
      }));
      configDirty = true;
      scheduleSave();
    };

    return {
      projectId,
      frame: initial.frame,
      durationSec: initial.durationSec,
      telemetrySettings: initial.telemetrySettings,
      config: initial.config,
      syncReport: initial.syncReport,
      mapMode: "map",
      saveState: "saved",
      selectedId: null,
      addMarkerMode: "none",
      pendingMarker: null,
      past: [],
      future: [],
      projectName: initial.projectName,
      companyName: initial.companyName,
      hasLogo: initial.hasLogo,
      logoVersion: 0,

      setProjectName(name) {
        pendingProjectPatch = { ...pendingProjectPatch, name };
        set({ projectName: name });
        scheduleSave();
      },

      setCompanyName(name) {
        pendingProjectPatch = { ...pendingProjectPatch, companyName: name };
        set({ companyName: name });
        scheduleSave();
      },

      setHasLogo(hasLogo) {
        set((s) => ({ hasLogo, logoVersion: s.logoVersion + 1 }));
      },

      setTelemetrySettings(patch) {
        pendingTelemetryPatch = { ...pendingTelemetryPatch, ...patch };
        set((s) => ({ telemetrySettings: { ...s.telemetrySettings, ...patch } }));
        scheduleSave();
      },

      setMapMode(mode) {
        set({ mapMode: mode });
      },

      updateElement(id, patch) {
        updateConfig((config) => ({
          ...config,
          template: "custom",
          elements: config.elements.map((el) => {
            if (el.id !== id) return el;
            const merged = { ...el, ...patch } as OverlayElement;
            return clampElement(merged, get().frame);
          }),
        }));
      },

      setVisible(id, visible) {
        get().updateElement(id, { visible });
      },

      setUnits(patch) {
        updateConfig((config) => ({ ...config, template: "custom", units: { ...config.units, ...patch } }));
      },

      setAltitudeSource(source) {
        updateConfig((config) => ({ ...config, template: "custom", altitudeSource: source }));
      },

      select(id) {
        set({ selectedId: id });
      },

      setPosition(id, corner) {
        updateConfig((config) => ({
          ...config,
          template: "custom",
          elements: config.elements.map((el) => (el.id === id ? positionPreset(el, corner, get().frame) : el)),
        }));
      },

      bringForward(id) {
        updateConfig((config) => {
          const el = config.elements.find((e) => e.id === id);
          if (!el) return config;
          const band = config.elements.filter((e) => isDynamic(e) === isDynamic(el)).sort((a, b) => a.zIndex - b.zIndex);
          const idx = band.findIndex((e) => e.id === id);
          if (idx === -1 || idx === band.length - 1) return config;
          const above = band[idx + 1];
          return {
            ...config,
            template: "custom",
            elements: config.elements.map((e) => {
              if (e.id === el.id) return { ...e, zIndex: above.zIndex };
              if (e.id === above.id) return { ...e, zIndex: el.zIndex };
              return e;
            }),
          };
        });
      },

      bringBackward(id) {
        updateConfig((config) => {
          const el = config.elements.find((e) => e.id === id);
          if (!el) return config;
          const band = config.elements.filter((e) => isDynamic(e) === isDynamic(el)).sort((a, b) => a.zIndex - b.zIndex);
          const idx = band.findIndex((e) => e.id === id);
          if (idx <= 0) return config;
          const below = band[idx - 1];
          return {
            ...config,
            template: "custom",
            elements: config.elements.map((e) => {
              if (e.id === el.id) return { ...e, zIndex: below.zIndex };
              if (e.id === below.id) return { ...e, zIndex: el.zIndex };
              return e;
            }),
          };
        });
      },

      undo() {
        const { past, config, future } = get();
        const previous = past[past.length - 1];
        if (!previous) return;
        set({ config: previous, past: past.slice(0, -1), future: [config, ...future].slice(0, HISTORY_LIMIT) });
        configDirty = true;
        scheduleSave();
      },

      redo() {
        const { future, config, past } = get();
        const next = future[0];
        if (!next) return;
        set({ config: next, future: future.slice(1), past: [...past, config].slice(-HISTORY_LIMIT) });
        configDirty = true;
        scheduleSave();
      },

      applyTemplate(id, ctx) {
        updateConfig((config) => {
          const next = instantiateTemplate(id, get().frame, ctx);
          return { ...next, mapMarkers: config.mapMarkers, elements: [...next.elements, ...config.elements.filter((el) => el.type === "videoMarker")] };
        });
      },

      setAddMarkerMode(mode) {
        set({ addMarkerMode: mode });
      },

      addMapMarker(lngLat, label) {
        const marker: MapMarker = { id: shortId("mm"), label, latitude: lngLat.lat, longitude: lngLat.lng };
        updateConfig((config) => ({ ...config, template: "custom", mapMarkers: [...config.mapMarkers, marker].slice(0, 20) }));
        set({ addMarkerMode: "none" });
      },

      addVideoMarker(at, label) {
        const duration = get().durationSec;
        const startTime = Math.max(0, Math.min(duration, at.time - VIDEO_MARKER_WINDOW_SEC));
        const endTime = Math.max(0, Math.min(duration, at.time + VIDEO_MARKER_WINDOW_SEC));
        const marker: VideoMarkerElement = {
          id: shortId("vm"),
          type: "videoMarker",
          x: at.x,
          y: at.y,
          width: 0.12,
          height: 0.04,
          opacity: 1,
          visible: true,
          zIndex: 130,
          label,
          startTime,
          endTime,
        };
        updateConfig((config) => ({
          ...config,
          template: "custom",
          elements: [...config.elements, clampElement(marker, get().frame)].slice(0, 40),
        }));
        set({ addMarkerMode: "none" });
      },

      removeElement(id) {
        updateConfig((config) => ({ ...config, template: "custom", elements: config.elements.filter((el) => !(el.id === id && el.type === "videoMarker")) }));
        if (get().selectedId === id) set({ selectedId: null });
      },

      removeMapMarker(id) {
        updateConfig((config) => ({ ...config, template: "custom", mapMarkers: config.mapMarkers.filter((m) => m.id !== id) }));
      },

      setPendingMarker(p) {
        set({ pendingMarker: p });
      },

      confirmPendingMarker(label) {
        const pending = get().pendingMarker;
        if (!pending) return;
        set({ pendingMarker: null });
        if (pending.kind === "map") get().addMapMarker(pending.lngLat, label);
        else get().addVideoMarker(pending.at, label);
      },

      async flush() {
        if (debounceHandle) {
          clearTimeout(debounceHandle);
          debounceHandle = null;
        }
        if (Object.keys(pendingTelemetryPatch).length === 0 && Object.keys(pendingProjectPatch).length === 0 && !configDirty) return;

        const telemetryBody = pendingTelemetryPatch;
        const projectBody = pendingProjectPatch;
        const sendConfig = configDirty;
        pendingTelemetryPatch = {};
        pendingProjectPatch = {};
        configDirty = false;

        set({ saveState: "saving" });
        try {
          const res = await fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...projectBody,
              ...(Object.keys(telemetryBody).length > 0 ? { telemetrySettings: telemetryBody } : {}),
              ...(sendConfig ? { overlayConfig: get().config } : {}),
            }),
          });
          if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
          const json = (await res.json()) as PatchProjectResponse;
          set({
            projectName: json.project.name,
            companyName: json.project.companyName,
            telemetrySettings: json.project.telemetrySettings,
            config: json.project.overlayConfig,
            syncReport: json.project.syncReport,
            saveState: "saved",
          });
        } catch {
          pendingTelemetryPatch = { ...telemetryBody, ...pendingTelemetryPatch };
          pendingProjectPatch = { ...projectBody, ...pendingProjectPatch };
          configDirty = configDirty || sendConfig;
          set({ saveState: "error" });
        }
      },
    };
  });

  return store;
}

export const EditorStoreContext = createContext<EditorStoreApi | null>(null);

export function useEditorStore<T>(selector: (state: EditorState) => T): T {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error("useEditorStore must be used within an EditorStoreContext provider");
  return useStore(store, selector);
}

export function useEditorStoreRef(projectId: string, initial: InitialEditorState): EditorStoreApi {
  const [store] = useState(() => createEditorStore(projectId, initial));
  return store;
}
