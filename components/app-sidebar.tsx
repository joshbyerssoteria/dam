"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Images,
  Palette,
  Search,
  Link2,
  UploadCloud,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/database.types";
import type { NavTreeNode } from "@/lib/nav-tree";

const SECONDARY_NAV = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/shares", label: "Share links", icon: Link2, roles: ["admin", "editor"] },
  { href: "/upload-tokens", label: "Upload tokens", icon: UploadCloud, roles: ["admin"] },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function containsActive(node: NavTreeNode, pathname: string): boolean {
  if (pathname === node.href || pathname.startsWith(`${node.href}/`)) return true;
  return node.children.some((child) => containsActive(child, pathname));
}

function TreeBranch({
  node,
  depth,
  pathname,
}: {
  node: NavTreeNode;
  depth: number;
  pathname: string;
}) {
  const active = pathname === node.href;
  const [expanded, setExpanded] = useState(() => containsActive(node, pathname));
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center rounded-md transition-colors",
          active
            ? "bg-accent font-medium text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        )}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            onClick={() => setExpanded((current) => !current)}
            className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
          >
            <ChevronRight
              className={cn(
                "size-3 transition-transform",
                expanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}
        <Link
          href={node.href}
          className="min-w-0 flex-1 truncate py-1 pr-2 text-[13px]"
          title={node.name}
        >
          {node.name}
        </Link>
      </div>
      {hasChildren && expanded ? (
        <div>
          {node.children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              pathname={pathname}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavSection({
  href,
  label,
  icon: Icon,
  tree,
  pathname,
}: {
  href: string;
  label: string;
  icon: typeof Images;
  tree: NavTreeNode[];
  pathname: string;
}) {
  const sectionActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
          sectionActive && pathname === href
            ? "bg-accent font-medium text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          sectionActive && pathname !== href && "text-foreground"
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} />
        {label}
      </Link>
      {tree.length > 0 ? (
        <div className="mb-1 ml-3 mt-0.5 border-l border-border pl-1">
          {tree.map((node) => (
            <TreeBranch key={node.id} node={node} depth={0} pathname={pathname} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AppSidebar({
  role,
  email,
  photoTree,
  kitTree,
}: {
  role: AppRole;
  email: string;
  photoTree: NavTreeNode[];
  kitTree: NavTreeNode[];
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-svh w-60 shrink-0 flex-col border-r border-border bg-background">
      <div className="px-5 pb-6 pt-6">
        <Link href="/photos" className="block">
          <span className="text-sm font-semibold tracking-tight">
            Soteria Assets
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <NavSection
          href="/photos"
          label="Photos"
          icon={Images}
          tree={photoTree}
          pathname={pathname}
        />
        <NavSection
          href="/kits"
          label="Kits"
          icon={Palette}
          tree={kitTree}
          pathname={pathname}
        />

        <div className="pt-2">
          {SECONDARY_NAV.filter(
            (item) =>
              !("roles" in item) || (item.roles as readonly string[]).includes(role)
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
        </div>
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
