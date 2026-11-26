import Image from "next/image";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children, image = "/images/scenes/snow-peak.svg" }:
  { title: string; subtitle?: ReactNode; children: ReactNode; image?: string }) {
  return (
    <div className="container-page grid gap-10 py-10 lg:grid-cols-[1.1fr_1fr] lg:py-16">
      <div className="order-2 lg:order-1">
        <h1 className="text-3xl text-forest-950 sm:text-4xl">{title}</h1>
        {subtitle && <div className="mt-2 text-muted">{subtitle}</div>}
        <div className="mt-8">{children}</div>
      </div>
      <div className="relative order-1 hidden min-h-[520px] overflow-hidden rounded-[2rem] lg:order-2 lg:block">
        <Image src={image} alt="" fill unoptimized className="object-cover" />
      </div>
    </div>
  );
}
