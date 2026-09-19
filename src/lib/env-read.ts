/** Dynamic key access so Next never inlines the value at build time. */
export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}
