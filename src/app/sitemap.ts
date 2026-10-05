import type { MetadataRoute } from "next";
import { PAGE_SEO, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return [];
  return Object.entries(PAGE_SEO).filter(([, page]) => page.public).map(([path]) => ({ url: new URL(path, SITE_URL).href, changeFrequency: "monthly", priority: path === "/" ? 1 : 0.7 }));
}
