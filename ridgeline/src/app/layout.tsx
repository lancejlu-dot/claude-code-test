import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DemoBanner } from "@/components/notices";
import { getBrand } from "@/lib/data/public";
import { isDemoMode, siteUrl } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: `${brand.name} — Outdoor community in the Lower Mainland`, template: `%s · ${brand.name}` },
    description: `${brand.tagline} Curated hikes, paddles, snowshoe trips and weekend adventures across Vancouver, the North Shore, Fraser Valley and Sea-to-Sky.`,
    openGraph: { type: "website", siteName: brand.name, images: ["/images/hero.svg"] },
    robots: isDemoMode ? { index: false, follow: false } : undefined,
  };
}

export const viewport: Viewport = { themeColor: "#1d3a28", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA">
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
        {isDemoMode && <DemoBanner />}
        <SiteHeader />
        <main id="main" className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
