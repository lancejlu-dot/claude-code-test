import {
  Award, Backpack, Bike, Car, Dumbbell, Flag, Footprints, Mountain, MountainSnow, Sailboat, ShieldCheck, Snowflake, Sparkles,
  Tent, Users, Waves, type LucideIcon, type LucideProps,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  mountain: Mountain, waves: Waves, sailboat: Sailboat, tent: Tent, backpack: Backpack, snowflake: Snowflake,
  "mountain-snow": MountainSnow, bike: Bike, footprints: Footprints, dumbbell: Dumbbell, car: Car, users: Users,
  award: Award, "shield-check": ShieldCheck, flag: Flag, sparkles: Sparkles,
};

export function NamedIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = MAP[name] ?? Mountain;
  return <Icon aria-hidden {...props} />;
}

export const ICON_NAMES = Object.keys(MAP);
