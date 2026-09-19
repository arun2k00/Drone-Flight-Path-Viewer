/** Lowercase [a-z0-9_], max 60 chars, falls back to "project" (used to build export file names, storage-key safe). */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
    .replace(/_+$/g, "");
  return slug || "project";
}
