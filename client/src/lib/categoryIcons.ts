import {
  Smartphone,
  Home as HomeIcon,
  Sparkles,
  Shirt,
  Zap,
  Laptop,
  Baby,
  Dumbbell,
  HeartPulse,
  Car,
  Camera,
  PawPrint,
  ShoppingBag,
  UtensilsCrossed,
  Moon,
  Footprints,
  Briefcase,
  Package,
  type LucideIcon,
} from "lucide-react";

// Static inline-SVG icons (zero extra requests, LCP-safe) mapped from the exact
// category names in the DB, with a Package fallback for anything unknown. The
// custom-categories table (icon_url/display_order) is a later, optional phase.

export type CategoryTint = "emerald" | "metallic" | "violet" | "yellow";

interface CategoryIconSpec {
  Icon: LucideIcon;
  tint: CategoryTint;
}

// Tints are rotated from existing design tokens (each has a light + dark
// variant in index.css) -- no hardcoded hex. Assignment is positional so the
// grid's order (productCount desc) cycles through all four evenly.
export const CATEGORY_TINTS: CategoryTint[] = ["emerald", "metallic", "violet", "yellow"];

export const CATEGORY_ICONS: Record<string, CategoryIconSpec> = {
  "Handphone & Aksesoris": { Icon: Smartphone, tint: "emerald" },
  "Perlengkapan Rumah": { Icon: HomeIcon, tint: "metallic" },
  "Perawatan & Kecantikan": { Icon: Sparkles, tint: "violet" },
  "Pakaian Wanita": { Icon: Shirt, tint: "yellow" },
  Elektronik: { Icon: Zap, tint: "emerald" },
  "Pakaian Pria": { Icon: Shirt, tint: "metallic" },
  "Komputer & Aksesoris": { Icon: Laptop, tint: "violet" },
  "Ibu & Bayi": { Icon: Baby, tint: "yellow" },
  "Olahraga & Outdoor": { Icon: Dumbbell, tint: "emerald" },
  Kesehatan: { Icon: HeartPulse, tint: "metallic" },
  Otomotif: { Icon: Car, tint: "violet" },
  Fotografi: { Icon: Camera, tint: "yellow" },
  "Hobi & Koleksi": { Icon: PawPrint, tint: "emerald" },
  "Tas Wanita": { Icon: ShoppingBag, tint: "metallic" },
  "Makanan & Minuman": { Icon: UtensilsCrossed, tint: "violet" },
  "Fashion Muslim": { Icon: Moon, tint: "yellow" },
  "Sepatu Pria": { Icon: Footprints, tint: "emerald" },
  "Tas Pria": { Icon: Briefcase, tint: "metallic" },
};

export function getCategoryIcon(name: string, index: number): CategoryIconSpec {
  const known = CATEGORY_ICONS[name];
  if (known) return known;
  return { Icon: Package, tint: CATEGORY_TINTS[index % CATEGORY_TINTS.length] };
}

// Tailwind classes per tint -- kept here so the arbitrary classes are visible to
// Tailwind's JIT (it scans this file, not the dynamic concatenation below).
export const TINT_CLASSES: Record<CategoryTint, string> = {
  emerald: "bg-emerald/10 text-emerald",
  metallic: "bg-metallic/10 text-metallic",
  violet: "bg-violet/10 text-violet",
  yellow: "bg-yellow/15 text-yellow",
};
