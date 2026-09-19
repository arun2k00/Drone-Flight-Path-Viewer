export type RangeResult =
  | { kind: "none" } // no/ignored header → 200 full body
  | { kind: "range"; start: number; end: number } // inclusive
  | { kind: "unsatisfiable" }; // → 416

export function parseRangeHeader(header: string | null, size: number): RangeResult {
  if (!header) return { kind: "none" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return { kind: "none" }; // multi-range/malformed: serve full body
  const [, a, b] = m;
  if (a === "" && b === "") return { kind: "unsatisfiable" };
  let start: number;
  let end: number;
  if (a === "") {
    const suffix = Number(b);
    if (suffix === 0) return { kind: "unsatisfiable" };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(a);
    end = b === "" ? size - 1 : Math.min(Number(b), size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
    return { kind: "unsatisfiable" };
  }
  return { kind: "range", start, end };
}
