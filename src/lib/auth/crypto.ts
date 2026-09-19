import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const scrypt = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))));

/** "scrypt$<salt>$<key>" (base64url). scrypt is in node:crypto, so no bcrypt/argon2 dependency. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${(await scrypt(password, salt)).toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** 256-bit URL-safe secret for session cookies, reset links and share links. */
export const newToken = () => randomBytes(32).toString("base64url");

/** Session and reset tokens are stored hashed, so a leaked database can't be replayed as logins. */
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
