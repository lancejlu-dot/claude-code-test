import type { MetadataRoute } from "next";
import { getPolicies, listEvents } from "@/lib/data/public";
import { siteUrl } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [events, policies] = await Promise.all([listEvents(), getPolicies()]);
  return [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/activities`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/faq`, changeFrequency: "monthly", priority: 0.6 },
    ...events.map((e) => ({ url: `${siteUrl}/activities/${e.slug}`, lastModified: e.published_at ?? undefined, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...policies.map((p) => ({ url: `${siteUrl}/policies/${p.slug}`, lastModified: p.updated_at, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
