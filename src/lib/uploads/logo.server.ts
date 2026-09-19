import "server-only";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { Resvg } from "@resvg/resvg-js";
import { AppError } from "@/lib/errors/app-error";

const MAX_LONG_SIDE = 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPngSignature(bytes: Uint8Array): boolean {
  return bytes.byteLength >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

/** "RIFF" + 4 size bytes + "WEBP". */
export function isWebpSignature(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return riff === "RIFF" && webp === "WEBP";
}

export function looksLikeSvg(bytes: Uint8Array): boolean {
  // SVGs may carry a UTF-8 BOM or leading whitespace/XML prolog before the <svg> tag.
  const head = Buffer.from(bytes.subarray(0, 4096)).toString("utf8");
  return /<svg[\s>]/i.test(head);
}

/**
 * Rasterizes an uploaded logo to PNG (max 1024px long side). SVG goes through resvg — which never
 * executes embedded `<script>` content — everything else is re-decoded and re-encoded via
 * @napi-rs/canvas so no arbitrary bytes reach storage untouched.
 */
export async function rasterizeLogo(bytes: Uint8Array, ext: ".png" | ".svg" | ".webp"): Promise<Buffer> {
  if (ext === ".svg") {
    const svgText = Buffer.from(bytes).toString("utf8");
    try {
      const png = new Resvg(svgText, { fitTo: { mode: "width", value: MAX_LONG_SIDE } }).render().asPng();
      return Buffer.from(png);
    } catch (err) {
      throw new AppError("LOGO_INVALID", { cause: err });
    }
  }

  let img: Awaited<ReturnType<typeof loadImage>>;
  try {
    img = await loadImage(Buffer.from(bytes));
  } catch (err) {
    throw new AppError("LOGO_INVALID", { cause: err });
  }
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = createCanvas(w, h);
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas.encode("png");
}
