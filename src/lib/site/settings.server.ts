import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db.server";

/** Admin-editable site content. Stored as one JSON row; missing keys fall back to these defaults. */
export const siteSettingsSchema = z.object({
  signupsOpen: z.boolean(),
  announcement: z.string().trim().max(160),
  heroEyebrow: z.string().trim().min(1).max(60),
  heroTitle: z.string().trim().min(1).max(120),
  heroSubtitle: z.string().trim().min(1).max(320),
  ctaPrimary: z.string().trim().min(1).max(30),
  ctaSecondary: z.string().trim().min(1).max(30),
  contactEmail: z.union([z.literal(""), z.email()]),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  signupsOpen: true,
  announcement: "",
  heroEyebrow: "For DJI pilots, surveyors and inspection teams",
  heroTitle: "Show clients exactly where the drone was.",
  heroSubtitle:
    "Aeroxpress pairs your DJI video with its SRT flight log. It plays the footage next to a live flight path, altitude and speed, then shares it with a link or exports an MP4 with the data burned in.",
  ctaPrimary: "Start free",
  ctaSecondary: "Try the viewer",
  contactEmail: "",
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const row = await prisma.siteSetting.findUnique({ where: { key: "site" } }).catch(() => null);
  const stored = siteSettingsSchema.partial().safeParse(row?.value ?? {});
  return { ...DEFAULT_SITE_SETTINGS, ...(stored.success ? stored.data : {}) };
}

export async function saveSiteSettings(next: SiteSettings): Promise<void> {
  await prisma.siteSetting.upsert({ where: { key: "site" }, create: { key: "site", value: next }, update: { value: next } });
}
