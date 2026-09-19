import "server-only";
import crypto from "node:crypto";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { getServerConfig } from "@/lib/config/env.server";
import { getStorage } from "@/lib/storage/index.server";
import { keys } from "@/lib/storage/keys";
import type { MapViewport } from "./projection";

const TILE_SIZE = 256;
const MAX_ZOOM = 19;
const MAX_TILES = 36;
const FETCH_TIMEOUT_MS = 8000;

const sha1 = (s: string): string => crypto.createHash("sha1").update(s).digest("hex");

export function basemapTemplateUrl(style: "map" | "satellite"): string | null {
  const config = getServerConfig();
  const url = style === "map" ? config.OVERLAY_MAP_TILE_URL : config.OVERLAY_SATELLITE_TILE_URL;
  return url && url.startsWith("https://") ? url : null;
}

function attributionFor(style: "map" | "satellite"): string {
  const config = getServerConfig();
  return (style === "map" ? config.OVERLAY_MAP_TILE_ATTRIBUTION : config.OVERLAY_SATELLITE_TILE_ATTRIBUTION) ?? "";
}

function tileUrl(template: string, z: number, x: number, y: number): string {
  return template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)).replace("{s}", "a").replace("{r}", "");
}

/** Cached indefinitely once fetched; eviction of entries older than 7 days is a separate housekeeping task. */
async function fetchTile(template: string, z: number, x: number, y: number): Promise<Buffer | null> {
  const config = getServerConfig();
  const key = keys.tileCache(sha1(template).slice(0, 12), z, x, y);
  const storage = getStorage();
  if (await storage.exists(key)) return Buffer.from(await storage.readBuffer(key));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(tileUrl(template, z, x, y), { headers: { "User-Agent": config.MAP_TILE_USER_AGENT }, signal: controller.signal }).finally(
      () => clearTimeout(timer),
    );
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await storage.save(key, buf);
    return buf;
  } catch {
    return null;
  }
}

interface TileRange {
  left: number;
  top: number;
  txMin: number;
  txMax: number;
  tyMin: number;
  tyMax: number;
}

function computeTileRange(viewport: MapViewport, widthPx: number, heightPx: number, z: number, scale: number): TileRange {
  const world = TILE_SIZE * 2 ** z;
  const centreX = viewport.cx * world;
  const centreY = viewport.cy * world;
  const left = centreX - widthPx / (2 * scale);
  const right = centreX + widthPx / (2 * scale);
  const top = centreY - heightPx / (2 * scale);
  const bottom = centreY + heightPx / (2 * scale);
  const maxTile = 2 ** z - 1;
  return {
    left,
    top,
    txMin: Math.floor(left / TILE_SIZE),
    txMax: Math.floor(right / TILE_SIZE),
    tyMin: Math.max(0, Math.min(maxTile, Math.floor(top / TILE_SIZE))),
    tyMax: Math.max(0, Math.min(maxTile, Math.floor(bottom / TILE_SIZE))),
  };
}

export interface BasemapResult {
  key: string;
  attribution: string;
}

/** Preview and export both call this with the same arguments, so they show the identical image. */
export async function renderBasemap(projectId: string, style: "map" | "satellite", viewport: MapViewport, widthPx: number): Promise<BasemapResult | null> {
  const template = basemapTemplateUrl(style);
  if (!template) return null;

  const heightPx = Math.round(widthPx / viewport.aspect);
  const zFloat = Math.log2((viewport.k * heightPx) / TILE_SIZE);
  let zInt = Math.max(0, Math.min(MAX_ZOOM, Math.ceil(zFloat)));
  let scale = 2 ** (zFloat - zInt);
  let range = computeTileRange(viewport, widthPx, heightPx, zInt, scale);
  let tileCount = (range.txMax - range.txMin + 1) * (range.tyMax - range.tyMin + 1);
  if (tileCount > MAX_TILES && zInt > 0) {
    zInt -= 1;
    scale = 2 ** (zFloat - zInt);
    range = computeTileRange(viewport, widthPx, heightPx, zInt, scale);
    tileCount = (range.txMax - range.txMin + 1) * (range.tyMax - range.tyMin + 1);
  }

  const canvas = createCanvas(widthPx, heightPx);
  const ctx = canvas.getContext("2d");
  const wrap = 2 ** zInt;
  let any = false;

  for (let ty = range.tyMin; ty <= range.tyMax; ty++) {
    for (let tx = range.txMin; tx <= range.txMax; tx++) {
      const wrappedTx = ((tx % wrap) + wrap) % wrap;
      const buf = await fetchTile(template, zInt, wrappedTx, ty);
      if (!buf) continue;
      any = true;
      const img = await loadImage(buf);
      const dx = (tx * TILE_SIZE - range.left) * scale;
      const dy = (ty * TILE_SIZE - range.top) * scale;
      ctx.drawImage(img, dx, dy, TILE_SIZE * scale, TILE_SIZE * scale);
    }
  }
  if (!any) return null;

  const hash = sha1(`${style}|${template}|${viewport.cx}|${viewport.cy}|${viewport.k}|${viewport.aspect}|${widthPx}`).slice(0, 16);
  const key = keys.basemap(projectId, hash);
  await getStorage().save(key, await canvas.encode("png"));
  return { key, attribution: attributionFor(style) };
}
