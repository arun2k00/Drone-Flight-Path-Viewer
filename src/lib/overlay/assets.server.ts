import "server-only";
import path from "node:path";
import { GlobalFonts, loadImage } from "@napi-rs/canvas";
import { OVERLAY_FONTS } from "./fonts";

let registered = false;

export function registerOverlayFonts(): void {
  if (registered) return;
  for (const { family, file } of OVERLAY_FONTS) {
    const key = GlobalFonts.registerFromPath(path.join(process.cwd(), "public", "fonts", file), family);
    if (!key) throw new Error(`Failed to register overlay font ${file}`);
  }
  registered = true;
}

export async function loadImageFromBuffer(buf: Uint8Array) {
  return loadImage(Buffer.from(buf));
}
