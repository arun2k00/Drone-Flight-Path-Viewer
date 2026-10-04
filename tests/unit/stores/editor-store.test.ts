import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultOverlayConfig } from "@/lib/overlay/templates";
import { createEditorStore } from "@/stores/editor-store";
import { DEFAULT_TELEMETRY_SETTINGS } from "@/types/telemetry";
import type { OverlayConfig } from "@/types/overlay";

const frame = { width: 1920, height: 1080 };

function makeStore() {
  const config = defaultOverlayConfig(frame, { hasGps: true, hasHeading: true, hasLogo: false });
  const store = createEditorStore("p1", {
    frame,
    durationSec: 60,
    telemetrySettings: DEFAULT_TELEMETRY_SETTINGS,
    config,
    syncReport: null,
    projectName: "Survey",
    companyName: null,
    hasLogo: false,
  });
  return { store, config };
}

/** A PATCH whose response the test releases by hand, echoing what the server would have stored. */
function deferredPatch() {
  const requests: Array<{ body: Record<string, unknown>; respond: (project: Record<string, unknown>) => void }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve) => {
          requests.push({ body: JSON.parse(String(init.body)), respond: (project) => resolve(Response.json({ project })) });
        }),
    ),
  );
  return requests;
}

const serverProject = (over: { name?: string; overlayConfig: OverlayConfig }) => ({
  name: over.name ?? "Survey",
  companyName: null,
  telemetrySettings: DEFAULT_TELEMETRY_SETTINGS,
  overlayConfig: over.overlayConfig,
  syncReport: null,
});

describe("editor store autosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps an edit made while a save is in flight, and sends it with the next save", async () => {
    const { store, config } = makeStore();
    const requests = deferredPatch();
    const el = config.elements[0];

    store.getState().setProjectName("Survey 2");
    const saving = store.getState().flush();
    expect(requests).toHaveLength(1);

    store.getState().updateElement(el.id, { x: el.x + 0.05 });
    const edited = store.getState().config;
    requests[0].respond(serverProject({ name: "Survey 2", overlayConfig: config }));
    await saving;

    expect(store.getState().config).toBe(edited);
    expect(store.getState().projectName).toBe("Survey 2");
    expect(store.getState().saveState).toBe("dirty");

    const next = store.getState().flush();
    expect(requests).toHaveLength(2);
    expect(requests[1].body.overlayConfig).toEqual(edited);
    requests[1].respond(serverProject({ name: "Survey 2", overlayConfig: edited }));
    await next;
    expect(store.getState().saveState).toBe("saved");
  });

  it("flush() waits for a save already in flight (Export must not navigate before it lands)", async () => {
    const { store, config } = makeStore();
    const requests = deferredPatch();

    store.getState().setProjectName("Survey 2");
    void store.getState().flush();
    let settled = false;
    const second = store.getState().flush().then(() => (settled = true));

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(requests).toHaveLength(1);

    requests[0].respond(serverProject({ name: "Survey 2", overlayConfig: config }));
    await second;
    expect(settled).toBe(true);
    expect(requests).toHaveLength(1);
  });
});

describe("editor store removeElement", () => {
  it("ignores elements that aren't video markers instead of switching the template to custom", () => {
    const { store, config } = makeStore();
    store.getState().removeElement(config.elements[0].id);
    expect(store.getState().config).toBe(config);
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().saveState).toBe("saved");
  });

  it("removes a video marker", () => {
    const { store } = makeStore();
    store.getState().addVideoMarker({ x: 0.5, y: 0.5, time: 10 }, "Tower");
    const marker = store.getState().config.elements.find((el) => el.type === "videoMarker")!;
    store.getState().removeElement(marker.id);
    expect(store.getState().config.elements.some((el) => el.id === marker.id)).toBe(false);
  });
});
