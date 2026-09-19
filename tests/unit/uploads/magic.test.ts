import { describe, expect, it } from "vitest";
import { isIsoBmff } from "@/lib/uploads/magic";

function bytesFromAscii(s: string): Uint8Array {
  return new Uint8Array([...s].map((c) => c.charCodeAt(0)));
}

describe("isIsoBmff", () => {
  it("accepts a valid ftyp box header", () => {
    const header = new Uint8Array(12);
    header.set(bytesFromAscii("ftyp"), 4);
    expect(isIsoBmff(header)).toBe(true);
  });

  it("accepts other known ISO-BMFF box types", () => {
    for (const box of ["moov", "mdat", "free", "wide", "skip", "pnot"]) {
      const header = new Uint8Array(8);
      header.set(bytesFromAscii(box), 4);
      expect(isIsoBmff(header)).toBe(true);
    }
  });

  it("rejects a text file renamed to .mp4", () => {
    expect(isIsoBmff(bytesFromAscii("This is just a text file, not a video."))).toBe(false);
  });

  it("rejects a header shorter than 8 bytes", () => {
    expect(isIsoBmff(new Uint8Array(4))).toBe(false);
  });
});
