import { extractDate, stripTags } from "./common";
import type { ExtractedField, ExtractedRecord, ParserStrategy } from "./types";

const CORE_BRACKET_RE = /\[[^\]]*\b(latitude|longitude|longtitude|rel_alt|abs_alt|altitude)\s*:[^\]]*\]/i;

/** DJI Air 3S / Mini 4 Pro / Mavic 4 Pro-style "[key: value key2: value2]" bracket groups. */
export const bracketStrategy: ParserStrategy = {
  id: "DJI_SRT_BRACKET",
  version: 1,

  detect(samples) {
    return samples.filter((s) => CORE_BRACKET_RE.test(s)).length / samples.length;
  },

  prepare() {
    return { coordinateOrder: "named", orderAssumed: false };
  },

  extract(payload): ExtractedRecord {
    const text = stripTags(payload);
    const frame = /\b(?:FrameCnt|SrtCnt)\s*:\s*(\d+)/i.exec(text);
    const fields: ExtractedField[] = [];

    for (const group of text.matchAll(/\[([^[\]]*)\]/g)) {
      const content = group[1];
      const keys = [...content.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)];
      keys.forEach((k, j) => {
        const start = (k.index ?? 0) + k[0].length;
        const end = j + 1 < keys.length ? (keys[j + 1].index ?? content.length) : content.length;
        fields.push({ key: k[1], raw: content.slice(start, end).trim().replace(/[,;]+$/, "").trim() });
      });
    }

    return { fields, frameIndex: frame ? Number(frame[1]) : null, recordedAt: extractDate(text) };
  },
};
