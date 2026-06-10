"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Images,
  Palette,
  Search,
  Link2,
  UploadCloud,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/database.types";

const NAV = [
  { href: "/photos", label: "Photos", icon: Images },
  { href: "/kits", label: "Kits", icon: Palette },
  { href: "/search", label: "Search", icon: Search },
  { href: "/shares", label: "Share links", icon: Link2, roles: ["admin", "editor"] },
  { href: "/upload-tokens", label: "Upload tokens", icon: UploadCloud, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar({
  role,
  email,
}: {
  role: AppRole;
  email: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-svh w-56 shrink-0 flex-col border-r border-border bg-background">
      <div className="px-5 pb-6 pt-6">
        <Link href="/photos" className="block">
          <span className="text-sm font-semibold tracking-tight">
            Soteria Assets
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.filter(
          (item) => !("roles" in item) || (item.roles as readonly string[]).includes(role)
        ).map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <item.icon className="size-4" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="truncate text-xs text-muted-foreground" title={email}>
          {email}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {role}
          </span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
