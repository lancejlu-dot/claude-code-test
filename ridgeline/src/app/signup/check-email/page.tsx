import Link from "next/link";
import { Mail } from "lucide-react";

export const metadata = { title: "Check your email" };

export default function CheckEmail() {
  return (
    <div className="container-page max-w-xl py-20 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-moss-100 text-forest-700"><Mail className="h-6 w-6" aria-hidden /></span>
      <h1 className="mt-6 text-3xl text-forest-950">Check your email</h1>
      <p className="mt-3 text-muted">We sent you a link to verify your email address. After verifying, an administrator will review your membership — we&apos;ll email you as soon as you&apos;re approved.</p>
      <Link href="/activities" className="btn-secondary mt-8">Browse upcoming activities</Link>
    </div>
  );
}
