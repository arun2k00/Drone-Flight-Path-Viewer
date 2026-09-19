import { describe, expect, it } from "vitest";
import { formatDuration } from "@/lib/format/duration";

describe("formatDuration", () => {
  it("formats minutes and seconds", () => {
    expect(formatDuration(292)).toBe("04:52");
    expect(formatDuration(0)).toBe("00:00");
  });

  it("formats past an hour", () => {
    expect(formatDuration(3723)).toBe("1:02:03");
  });

  it("formats milliseconds for the timeline", () => {
    expect(formatDuration(12.533, { milliseconds: true })).toBe("00:12.533");
  });

  it("handles invalid input", () => {
    expect(formatDuration(Number.NaN)).toBe("—");
    expect(formatDuration(-1)).toBe("—");
  });
});
