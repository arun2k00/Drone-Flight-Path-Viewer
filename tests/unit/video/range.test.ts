import { describe, expect, it } from "vitest";
import { parseRangeHeader } from "@/lib/video/range";

describe("parseRangeHeader", () => {
  const SIZE = 1000;

  it("returns 'none' when there is no header", () => {
    expect(parseRangeHeader(null, SIZE)).toEqual({ kind: "none" });
  });

  it("parses a normal range", () => {
    expect(parseRangeHeader("bytes=0-99", SIZE)).toEqual({ kind: "range", start: 0, end: 99 });
  });

  it("parses an open-ended range", () => {
    expect(parseRangeHeader("bytes=500-", SIZE)).toEqual({ kind: "range", start: 500, end: 999 });
  });

  it("parses a suffix range", () => {
    expect(parseRangeHeader("bytes=-100", SIZE)).toEqual({ kind: "range", start: 900, end: 999 });
  });

  it("clamps an end beyond the file size", () => {
    expect(parseRangeHeader("bytes=900-999999999999", SIZE)).toEqual({ kind: "range", start: 900, end: 999 });
  });

  it("is unsatisfiable when start is at or past size", () => {
    expect(parseRangeHeader("bytes=1000-", SIZE)).toEqual({ kind: "unsatisfiable" });
    expect(parseRangeHeader("bytes=999999999999-", SIZE)).toEqual({ kind: "unsatisfiable" });
  });

  it("is unsatisfiable for a zero-length suffix", () => {
    expect(parseRangeHeader("bytes=-0", SIZE)).toEqual({ kind: "unsatisfiable" });
  });

  it("falls back to 'none' for a malformed or multi-range header", () => {
    expect(parseRangeHeader("bytes=0-99,200-299", SIZE)).toEqual({ kind: "none" });
    expect(parseRangeHeader("nonsense", SIZE)).toEqual({ kind: "none" });
  });

  it("is unsatisfiable when both bounds are empty", () => {
    expect(parseRangeHeader("bytes=-", SIZE)).toEqual({ kind: "unsatisfiable" });
  });
});
