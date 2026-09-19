import { describe, expect, it } from "vitest";
import { contentDisposition } from "@/lib/format/content-disposition";

describe("contentDisposition", () => {
  it("includes both the ASCII-safe and UTF-8 encoded filename", () => {
    const header = contentDisposition("hyderabad_survey.mp4");
    expect(header).toBe('attachment; filename="hyderabad_survey.mp4"; filename*=UTF-8\'\'hyderabad_survey.mp4');
  });

  it("strips quotes, backslashes and control characters from the ASCII-safe part", () => {
    const header = contentDisposition('evil".mp4');
    expect(header).toContain('filename="evil_.mp4"');
  });

  it("percent-encodes non-ASCII characters", () => {
    const header = contentDisposition("naïve.mp4");
    expect(header).toContain("filename*=UTF-8''na%C3%AFve.mp4");
    expect(header).toContain('filename="na_ve.mp4"');
  });
});
