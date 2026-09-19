import { NUM, extractDate, stripTags } from "./common";
import type { ExtractedField, ExtractedRecord, ParserStrategy, StrategyContext } from "./types";

const GPS_TUPLE_RE = new RegExp(String.raw`\bGPS\s*\(\s*(${NUM})\s*,\s*(${NUM})\s*(?:,\s*(${NUM})\s*([A-Za-z]*))?\s*\)`);

function inlineText(payload: string): string {
  return stripTags(payload).replace(/\n/g, " ");
}

/** Phantom 4 Pro/RTK, Mavic Pro, Inspire 2-style "F/5.6, GPS(...), H 85.80m, H.S 2.50m/s" lines. */
export const inlineStrategy: ParserStrategy = {
  id: "DJI_SRT_INLINE",
  version: 1,

  detect(samples) {
    return (
      (0.95 * samples.filter((s) => /\bGPS\s*\(/.test(s) || /\bH\.S\s*-?\d/.test(s) || /\bBAROMETER\s*[:(]/i.test(s)).length) /
      samples.length
    );
  },

  prepare(payloads, settings): StrategyContext {
    if (settings.coordinateOrder === "lat-lon" || settings.coordinateOrder === "lon-lat") {
      return { coordinateOrder: settings.coordinateOrder, orderAssumed: false };
    }
    let aBig = false;
    let bBig = false;
    for (const p of payloads) {
      const m = GPS_TUPLE_RE.exec(inlineText(p));
      if (!m) continue;
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6) continue;
      if (Math.abs(a) > 90) aBig = true;
      if (Math.abs(b) > 90) bBig = true;
    }
    if (aBig) return { coordinateOrder: "lon-lat", orderAssumed: false };
    if (bBig) return { coordinateOrder: "lat-lon", orderAssumed: false };
    return { coordinateOrder: "lon-lat", orderAssumed: true };
  },

  extract(payload, ctx): ExtractedRecord {
    const text = inlineText(payload);
    const fields: ExtractedField[] = [];
    const push = (key: string, raw: string) => fields.push({ key, raw });

    const gps = GPS_TUPLE_RE.exec(text);
    if (gps) {
      const [lat, lon] = ctx.coordinateOrder === "lat-lon" ? [gps[1], gps[2]] : [gps[2], gps[1]];
      push("latitude", lat);
      push("longitude", lon);
      if (gps[3] !== undefined && /^m$/i.test(gps[4] ?? "")) push("abs_alt", gps[3]);
    }

    const h = new RegExp(String.raw`\bH\s*[= ]\s*(${NUM})\s*m\b`).exec(text);
    if (h) {
      push("rel_alt", h[1]);
    } else {
      const baro = new RegExp(String.raw`\bBAROMETER\s*[:(]\s*(${NUM})\s*M?\s*\)?`, "i").exec(text);
      if (baro) push("barometer", baro[1]);
    }

    const hs = new RegExp(String.raw`\bH\.S\s*[= ]?\s*(${NUM})\s*(m\/s|km\/h)?`, "i").exec(text);
    if (hs) push("h.s", hs[1] + (hs[2] ?? ""));
    const vs = new RegExp(String.raw`\bV\.S\s*[= ]?\s*(${NUM})\s*(m\/s|km\/h)?`, "i").exec(text);
    if (vs) push("v.s", vs[1] + (vs[2] ?? ""));

    const triple = (label: string) => new RegExp(String.raw`\b${label}\s*\(\s*(${NUM})°?\s*,\s*(${NUM})°?\s*,\s*(${NUM})°?\s*\)`).exec(text);
    const f = triple(String.raw`F\.PRY`);
    if (f) {
      push("drone_pitch", f[1]);
      push("drone_roll", f[2]);
      push("drone_yaw", f[3]);
    }
    const g = triple(String.raw`G\.PRY`);
    if (g) {
      push("gb_pitch", g[1]);
      push("gb_roll", g[2]);
      push("gb_yaw", g[3]);
    }

    if (/\bHOME\s*\(/i.test(text)) push("home", "");
    const d = new RegExp(String.raw`\bD\s*[= ]\s*(${NUM})\s*m\b`).exec(text);
    if (d) push("d", d[1]);

    const camera: Array<[string, RegExp]> = [
      ["iso", /\bISO\s*[: ]\s*(\d+)/i],
      ["ss", /\bSS\s+(\d+(?:\.\d+)?)/],
      ["shutter", /\bShutter\s*[: ]\s*([^\s,]+)/i],
      ["ev", /\bEV\s*[: ]\s*(-?\d+(?:\.\d+)?)/i],
      ["fnum", /\bFnum\s*[: ]\s*([^\s,]+)/i],
    ];
    for (const [key, re] of camera) {
      const m = re.exec(text);
      if (m) push(key, m[1]);
    }

    return { fields, frameIndex: null, recordedAt: extractDate(text) };
  },
};
