import { describe, expect, it } from "vitest";
import { hashPassword, newToken, sha256, verifyPassword } from "@/lib/auth/crypto";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const stored = await hashPassword("correct horse 42");
    expect(stored).toMatch(/^scrypt\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword("correct horse 42", stored)).toBe(true);
    expect(await verifyPassword("correct horse 43", stored)).toBe(false);
  });

  it("salts every hash and rejects malformed stored values", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
    expect(await verifyPassword("x", "bcrypt$abc$def")).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });

  it("tokens are 256-bit url-safe and hashed deterministically", () => {
    const t = newToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(t);
    expect(sha256(t)).toBe(sha256(t));
    expect(sha256(t)).toHaveLength(64);
  });
});
