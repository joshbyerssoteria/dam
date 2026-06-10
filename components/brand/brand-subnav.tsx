"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/brand", label: "Overview" },
  { href: "/brand/logos", label: "Logos" },
  { href: "/brand/colors", label: "Colors" },
  { href: "/brand/typography", label: "Typography" },
  { href: "/brand/guidelines", label: "Guidelines" },
  { href: "/brand/examples", label: "Examples" },
] as const;

export function BrandSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Brand guide sections"
      className="flex gap-1 overflow-x-auto border-b border-border px-8"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/brand"
            ? pathname === "/brand"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
