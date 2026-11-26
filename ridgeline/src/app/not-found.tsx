import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page max-w-xl py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-4xl text-forest-950">Off the map</h1>
      <p className="mt-3 text-muted">We couldn&apos;t find that page. It may have been moved, or the trail ends here.</p>
      <Link href="/activities" className="btn-primary mt-8">Find an activity</Link>
    </div>
  );
}
