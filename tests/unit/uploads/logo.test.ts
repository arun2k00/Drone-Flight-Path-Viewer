import { createCanvas, loadImage } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { isPngSignature, isWebpSignature, looksLikeSvg, rasterizeLogo } from "@/lib/uploads/logo.server";

function bytesFromAscii(s: string): Uint8Array {
  return new Uint8Array([...s].map((c) => c.charCodeAt(0)));
}

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8DwnwELYBxVSF9FAAhKAwFacTQfAAAAAElFTkSuQmCC";

function makeWebpBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set(bytesFromAscii("RIFF"), 0);
  bytes.set(bytesFromAscii("WEBP"), 8);
  return bytes;
}

describe("isPngSignature", () => {
  it("accepts a real PNG signature", () => {
    expect(isPngSignature(Buffer.from(TINY_PNG_BASE64, "base64"))).toBe(true);
  });

  it("rejects a JPEG-ish or too-short buffer", () => {
    expect(isPngSignature(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(false);
    expect(isPngSignature(new Uint8Array(4))).toBe(false);
  });
});

describe("isWebpSignature", () => {
  it("accepts RIFF....WEBP", () => {
    expect(isWebpSignature(makeWebpBytes())).toBe(true);
  });

  it("rejects a PNG or a too-short buffer", () => {
    expect(isWebpSignature(Buffer.from(TINY_PNG_BASE64, "base64"))).toBe(false);
    expect(isWebpSignature(new Uint8Array(8))).toBe(false);
  });
});

describe("looksLikeSvg", () => {
  it("accepts a plain <svg> document", () => {
    expect(looksLikeSvg(bytesFromAscii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(true);
  });

  it("accepts an <svg> preceded by an XML prolog", () => {
    expect(looksLikeSvg(bytesFromAscii('<?xml version="1.0"?>\n<svg></svg>'))).toBe(true);
  });

  it("rejects a PNG or unrelated text", () => {
    expect(looksLikeSvg(Buffer.from(TINY_PNG_BASE64, "base64"))).toBe(false);
    expect(looksLikeSvg(bytesFromAscii("<not-svg>hello</not-svg>"))).toBe(false);
  });
});

describe("rasterizeLogo", () => {
  it("re-encodes a PNG and scales it down to the 1024px long-side cap", async () => {
    const source = createCanvas(2000, 1000);
    source.getContext("2d").fillRect(0, 0, 2000, 1000);
    const png = await rasterizeLogo(await source.encode("png"), ".png");
    const decoded = await loadImage(png);
    expect(decoded.width).toBe(1024);
    expect(decoded.height).toBe(512);
  });

  it("leaves a small PNG's dimensions untouched", async () => {
    const png = await rasterizeLogo(Buffer.from(TINY_PNG_BASE64, "base64"), ".png");
    const decoded = await loadImage(png);
    expect(decoded.width).toBe(8);
    expect(decoded.height).toBe(8);
  });

  it("rasterizes an SVG containing a <script> tag to a clean PNG (never executes the script)", async () => {
    const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50">
      <script>window.__pwned = true;</script>
      <rect width="100" height="50" fill="red"/>
    </svg>`;
    const png = await rasterizeLogo(bytesFromAscii(maliciousSvg), ".svg");
    expect(isPngSignature(png)).toBe(true);
    const decoded = await loadImage(png);
    expect(decoded.width).toBeGreaterThan(0);
    expect(decoded.height).toBeGreaterThan(0);
  });

  it("throws AppError('LOGO_INVALID') for unparseable image bytes", async () => {
    await expect(rasterizeLogo(bytesFromAscii("not an image"), ".png")).rejects.toMatchObject({ code: "LOGO_INVALID" });
  });

  it("throws AppError('LOGO_INVALID') for malformed SVG markup", async () => {
    await expect(rasterizeLogo(bytesFromAscii("<svg><unclosed"), ".svg")).rejects.toMatchObject({ code: "LOGO_INVALID" });
  });
});
