import type { MetadataRoute } from "next";
import { isDemoMode, siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  if (isDemoMode) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/api", "/members", "/waivers", "/auth", "/*/hub", "/*/apply"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
