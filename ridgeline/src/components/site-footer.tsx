import Link from "next/link";
import { getBrand, getPolicies } from "@/lib/data/public";

export async function SiteFooter() {
  const [brand, policies] = await Promise.all([getBrand(), getPolicies()]);
  return (
    <footer className="mt-24 bg-forest-950 text-sand-100">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-2xl text-white">{brand.name}</p>
          <p className="mt-2 max-w-sm text-sm text-sand-100/70">{brand.tagline}</p>
          <p className="mt-4 text-xs text-sand-100/50">
            Serving the {brand.region_label}. We acknowledge that our activities take place on the traditional, ancestral and unceded
            territories of the Coast Salish peoples.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Community</p>
          <ul className="mt-3 space-y-2 text-sm text-sand-100/70">
            <li><Link href="/activities" className="hover:text-white">Activities</Link></li>
            <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
            <li><Link href="/signup" className="hover:text-white">Join</Link></li>
            <li><Link href="/report" className="hover:text-white">Report a concern</Link></li>
            <li><a href={`mailto:${brand.contact_email}`} className="hover:text-white">Contact</a></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Policies</p>
          <ul className="mt-3 space-y-2 text-sm text-sand-100/70">
            {policies.map((p) => <li key={p.slug}><Link href={`/policies/${p.slug}`} className="hover:text-white">{p.title}</Link></li>)}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-sand-100/50 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} {brand.name}</span>
          <span>In an emergency, call 911. Trip planning: AdventureSmart.ca · Avalanche forecasts: avalanche.ca</span>
        </div>
      </div>
    </footer>
  );
}
