import Image from "next/image";
import { cn } from "@/lib/format";

const FALLBACK: Record<string, string> = {
  hiking: "/images/scenes/forest-falls.svg", kayaking: "/images/scenes/fjord-paddle.svg", paddleboarding: "/images/scenes/beach-sunrise.svg",
  camping: "/images/scenes/lake-camp.svg", backpacking: "/images/scenes/alpine-lake.svg", snowshoeing: "/images/scenes/snow-forest.svg",
  "skiing-snowboarding": "/images/scenes/alpine-bowl.svg", cycling: "/images/scenes/coast-road.svg", "trail-running": "/images/scenes/lake-dusk.svg",
  "outdoor-fitness": "/images/scenes/beach-sunrise.svg", "road-trips": "/images/scenes/valley-road.svg", social: "/images/scenes/evening-lights.svg",
};

/** Event photo with an illustrated fallback per category. SVG artwork is served as-is. */
export function EventImage({ src, category, alt, className, priority, sizes = "(min-width: 1024px) 33vw, 100vw" }:
  { src: string | null; category?: string; alt: string; className?: string; priority?: boolean; sizes?: string }) {
  const url = src || FALLBACK[category ?? ""] || "/images/hero.svg";
  return (
    <Image src={url} alt={alt} fill priority={priority} sizes={sizes} unoptimized={url.endsWith(".svg")}
      className={cn("object-cover", className)} />
  );
}
