import { readFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED = new Set(["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]);

/**
 * MapLibre 6's worker URL is computed at runtime from import.meta.url, which Turbopack doesn't
 * rewrite — without this route the worker 404s and GeoJSON layers silently render nothing.
 * The version is part of the path, so the worker's relative import of the shared module resolves
 * to the same version, and immutable caching is safe across upgrades.
 */
export async function GET(_req: Request, ctx: RouteContext<"/vendor/maplibre/[version]/[file]">) {
  const { version, file } = await ctx.params;
  const dist = path.join(process.cwd(), "node_modules", "maplibre-gl");
  const pkg = JSON.parse(await readFile(path.join(dist, "package.json"), "utf8")) as { version: string };
  if (version !== pkg.version || !ALLOWED.has(file)) return new Response("Not found", { status: 404 });
  const body = await readFile(path.join(dist, "dist", file));
  return new Response(body, {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
