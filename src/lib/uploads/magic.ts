const ISO_BMFF_BRANDS = new Set(["ftyp", "moov", "mdat", "free", "wide", "skip", "pnot"]);

/** Bytes 4-7 of an MP4/MOV/M4V file name a box type (ftyp/moov/…), per the ISO-BMFF container format. */
export function isIsoBmff(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 8) return false;
  const brand = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  return ISO_BMFF_BRANDS.has(brand);
}
