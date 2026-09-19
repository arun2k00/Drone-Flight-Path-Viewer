function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, "%2A");
}

/** `attachment; filename="…"; filename*=UTF-8''…` (RFC 5987/6266). The ASCII-safe part never contains quotes, backslashes, control chars or non-ASCII. */
export function contentDisposition(fileName: string): string {
  const asciiSafe = fileName.replace(/[\x00-\x1f\x7f"\\]/g, "_").replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${asciiSafe}"; filename*=UTF-8''${percentEncode(fileName)}`;
}
