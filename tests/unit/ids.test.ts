import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { isUuid, parseUuidParam } from "@/lib/ids";

describe("isUuid", () => {
  it("accepts a valid v4 UUID", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
  });

  it("rejects malformed ids", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("11111111-1111-1111-1111-11111111111")).toBe(false);
  });
});

describe("parseUuidParam", () => {
  it("returns the value when valid", () => {
    expect(parseUuidParam("11111111-1111-4111-8111-111111111111", "PROJECT_NOT_FOUND")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("throws the given AppError code for malformed ids (no information leak)", () => {
    try {
      parseUuidParam("not-a-uuid", "PROJECT_NOT_FOUND");
      throw new Error("expected parseUuidParam to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("PROJECT_NOT_FOUND");
      expect((err as AppError).status).toBe(404);
    }
  });
});
