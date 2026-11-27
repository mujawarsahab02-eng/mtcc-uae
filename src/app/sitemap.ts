import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mtccuae.com";

// Public pages only. Admin pages are never listed.
const PAGES: [string, number][] = [
  ["/", 1],
  ["/gallery", 0.9],
  ["/blog", 0.8],
  ["/matches", 0.8],
  ["/standings", 0.7],
  ["/teams", 0.7],
  ["/season-2", 0.7],
  ["/rules", 0.6],
  ["/feedback", 0.4],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PAGES.map(([path, priority]) => ({ url: `${siteUrl}${path === "/" ? "" : path}`, lastModified: now, changeFrequency: "weekly", priority }));
}
