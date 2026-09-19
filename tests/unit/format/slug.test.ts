import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/format/slug";

describe("slugify", () => {
  it("lowercases and replaces non-alphanumerics", () => {
    expect(slugify("Hyderabad Site Survey")).toBe("hyderabad_site_survey");
  });

  it("falls back to 'project' for empty input", () => {
    expect(slugify("   ")).toBe("project");
    expect(slugify("!!!")).toBe("project");
  });

  it("caps length at 60 characters", () => {
    const result = slugify("a".repeat(100));
    expect(result.length).toBeLessThanOrEqual(60);
  });
});
