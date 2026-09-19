import { describe, expect, it } from "vitest";
import { formatBytes } from "@/lib/format/bytes";

describe("formatBytes", () => {
  it("formats the MAX_VIDEO_SIZE_MB default exactly", () => {
    expect(formatBytes(4096 * 1024 * 1024)).toBe("4 GB");
  });

  it("formats sub-GB and sub-MB sizes", () => {
    expect(formatBytes(1.2 * 1024 * 1024)).toBe("1.2 MB");
    expect(formatBytes(500)).toBe("500 B");
  });

  it("handles zero and negative input", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-10)).toBe("0 B");
  });
});
