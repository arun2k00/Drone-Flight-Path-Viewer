import { CORE_TARGETS, mapKey, normalizeKey } from "../fields";
import { extractDate, stripTags } from "./common";
import type { ExtractedField, ExtractedRecord, ParserStrategy } from "./types";

function extract(payload: string): ExtractedRecord {
  const text = stripTags(payload);
  const fields: ExtractedField[] = [];
  for (const m of text.matchAll(/([A-Za-z_][A-Za-z0-9_.]*)\s*[:=]\s*(-?\d+(?:[.,]\d+)?(?:\s*(?:m\/s|km\/h|mph|kn|m|ft|°))?)/g)) {
    fields.push({ key: m[1], raw: m[2] });
  }
  return { fields, frameIndex: null, recordedAt: extractDate(text) };
}

function hasCoreField(payload: string): boolean {
  return extract(payload).fields.some((f) => {
    const target = mapKey(normalizeKey(f.key));
    return target !== null && CORE_TARGETS.has(target);
  });
}

/** Non-DJI or unusual files, e.g. "lat=17.385044 lon=78.486671 alt=40.0 speed=5.5". */
export const genericStrategy: ParserStrategy = {
  id: "GENERIC_KEY_VALUE",
  version: 1,

  detect(samples) {
    return (0.5 * samples.filter((s) => hasCoreField(s)).length) / samples.length;
  },

  prepare() {
    return { coordinateOrder: "named", orderAssumed: false };
  },

  extract,
};
