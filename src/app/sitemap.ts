import type { MetadataRoute } from "next"
import { TOOLS } from "@/lib/seo/tools"
import { SITE } from "@/lib/seo/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date("2026-11-20")
  return [
    { url: SITE.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/editor`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...TOOLS.map((t) => ({
      url: `${SITE.url}/${t.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: t.category === "Privatsphäre" ? 0.9 : 0.8,
    })),
  ]
}
