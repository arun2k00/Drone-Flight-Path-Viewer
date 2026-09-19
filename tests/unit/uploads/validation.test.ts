import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { sanitizeOriginalName, validateUploadInit, type UploadLimitsBytes } from "@/lib/uploads/validation";

const limits: UploadLimitsBytes = { maxVideoBytes: 10_000, maxSrtBytes: 1_000, maxLogoBytes: 500 };

function codeOf(fn: () => unknown): string {
  try {
    fn();
    throw new Error("expected to throw");
  } catch (err) {
    if (err instanceof AppError) return err.code;
    throw err;
  }
}

describe("validateUploadInit", () => {
  it("accepts a valid video upload (case-insensitive extension)", () => {
    expect(validateUploadInit({ role: "VIDEO", fileName: "clip.MP4", sizeBytes: 500 }, limits)).toEqual({
      ext: ".mp4",
      mimeType: "video/mp4",
    });
  });

  it("rejects an unsupported video extension", () => {
    expect(codeOf(() => validateUploadInit({ role: "VIDEO", fileName: "clip.avi", sizeBytes: 500 }, limits))).toBe(
      "VIDEO_UNSUPPORTED_TYPE",
    );
  });

  it("rejects a video over the size limit", () => {
    expect(codeOf(() => validateUploadInit({ role: "VIDEO", fileName: "clip.mp4", sizeBytes: 20_000 }, limits))).toBe(
      "VIDEO_TOO_LARGE",
    );
  });

  it("rejects an empty file for any role", () => {
    expect(codeOf(() => validateUploadInit({ role: "VIDEO", fileName: "clip.mp4", sizeBytes: 0 }, limits))).toBe("FILE_EMPTY");
  });

  it("validates the TELEMETRY role", () => {
    expect(validateUploadInit({ role: "TELEMETRY", fileName: "flight.SRT", sizeBytes: 10 }, limits)).toEqual({
      ext: ".srt",
      mimeType: "application/x-subrip",
    });
    expect(codeOf(() => validateUploadInit({ role: "TELEMETRY", fileName: "flight.srt", sizeBytes: 2_000 }, limits))).toBe(
      "SRT_TOO_LARGE",
    );
    expect(codeOf(() => validateUploadInit({ role: "TELEMETRY", fileName: "notes.txt", sizeBytes: 10 }, limits))).toBe(
      "SRT_UNSUPPORTED_TYPE",
    );
  });

  it("validates the LOGO role", () => {
    expect(validateUploadInit({ role: "LOGO", fileName: "logo.png", sizeBytes: 10 }, limits)).toEqual({
      ext: ".png",
      mimeType: "image/png",
    });
    expect(codeOf(() => validateUploadInit({ role: "LOGO", fileName: "logo.bmp", sizeBytes: 10 }, limits))).toBe("LOGO_INVALID");
  });
});

describe("sanitizeOriginalName", () => {
  it("strips control characters and path separators", () => {
    expect(sanitizeOriginalName("a/b\\c.mp4")).toBe("a_b_c.mp4");
  });

  it("falls back to 'upload' for empty/whitespace names", () => {
    expect(sanitizeOriginalName("   ")).toBe("upload");
  });

  it("caps length at 255 characters", () => {
    expect(sanitizeOriginalName("a".repeat(300)).length).toBe(255);
  });
});
