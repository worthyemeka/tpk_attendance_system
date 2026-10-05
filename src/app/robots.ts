import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  // Page routes remain crawlable so crawlers can read their noindex directives.
  // Access control, not robots.txt, protects private records.
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/uploads/"] }, sitemap: `${SITE_URL}/sitemap.xml`, host: SITE_URL };
}
