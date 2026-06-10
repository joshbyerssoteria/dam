"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  BookOpen,
  ChevronRight,
  Images,
  Palette,
  Search,
  Link2,
  UploadCloud,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { moveKitToFolder } from "@/lib/actions/kit-folders";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/database.types";
import type { NavTreeNode } from "@/lib/nav-tree";

const BRAND_GUIDE_LINKS = [
  { href: "/brand/logos", label: "Logos" },
  { href: "/brand/colors", label: "Colors" },
  { href: "/brand/typography", label: "Typography" },
  {
    href: "/brand/examples",
    label: "Examples",
    children: [
      { href: "/brand/examples/compositions", label: "Compositions" },
      { href: "/brand/examples/blocks", label: "Blocks" },
      { href: "/brand/examples/components", label: "Components" },
      { href: "/brand/examples/slides", label: "Slides" },
    ],
  },
] as const;

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

function findNode(nodes: NavTreeNode[], id: string): NavTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Row chrome shared by both trees; drag/drop hooks attach via wrappers. */
function BranchRow({
  node,
  depth,
  pathname,
  expanded,
  onToggle,
  isDropTarget = false,
  dragProps,
}: {
  node: NavTreeNode;
  depth: number;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  isDropTarget?: boolean;
  dragProps?: Record<string, unknown>;
}) {
  const active = pathname === node.href;
  const hasChildren = node.children.length > 0;

  return (
    <div
      className={cn(
        "group flex items-center rounded-md transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        isDropTarget && "bg-accent ring-1 ring-ring"
      )}
      style={{ paddingLeft: `${depth * 12}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          onClick={onToggle}
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
        >
          <ChevronRight
            className={cn("size-3 transition-transform", expanded && "rotate-90")}
          />
        </button>
      ) : (
        <span className="size-5 shrink-0" />
      )}
      <Link
        href={node.href}
        draggable={false}
        {...(dragProps ?? {})}
        className="min-w-0 flex-1 truncate py-1 pr-2 text-[13px]"
        title={node.name}
      >
        {node.name}
      </Link>
    </div>
  );
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
  const [expanded, setExpanded] = useState(() => containsActive(node, pathname));

  return (
    <div>
      <BranchRow
        node={node}
        depth={depth}
        pathname={pathname}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
      />
      {node.children.length > 0 && expanded ? (
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

/** Kits tree branch: kit leaves drag; folder rows accept drops. */
function KitsTreeBranch({
  node,
  depth,
  pathname,
}: {
  node: NavTreeNode;
  depth: number;
  pathname: string;
}) {
  const [expanded, setExpanded] = useState(() => containsActive(node, pathname));
  const isFolder = node.kind === "folder";

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `kitfolder:${node.id}`,
    disabled: !isFolder,
  });
  const {
    setNodeRef: setDragRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({
    id: `kit:${node.id}`,
    disabled: isFolder,
  });

  return (
    <div ref={isFolder ? setDropRef : undefined}>
      <div
        ref={!isFolder ? setDragRef : undefined}
        className={cn(isDragging && "opacity-40")}
      >
        <BranchRow
          node={node}
          depth={depth}
          pathname={pathname}
          expanded={expanded}
          onToggle={() => setExpanded((current) => !current)}
          isDropTarget={isFolder && isOver}
          dragProps={!isFolder ? { ...attributes, ...listeners } : undefined}
        />
      </div>
      {node.children.length > 0 && expanded ? (
        <div>
          {node.children.map((child) => (
            <KitsTreeBranch
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

function SectionLink({
  href,
  label,
  icon: Icon,
  pathname,
  dropRef,
  isDropTarget = false,
}: {
  href: string;
  label: string;
  icon: typeof Images;
  pathname: string;
  dropRef?: (element: HTMLElement | null) => void;
  isDropTarget?: boolean;
}) {
  const sectionActive = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      ref={dropRef as React.Ref<HTMLAnchorElement>}
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        sectionActive && pathname === href
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        sectionActive && pathname !== href && "text-foreground",
        isDropTarget && "bg-accent ring-1 ring-ring"
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
      {label}
    </Link>
  );
}

/** Rendered inside DndContext so the root droppable hook has a provider. */
function KitsNavTreeArea({
  kitTree,
  pathname,
}: {
  kitTree: NavTreeNode[];
  pathname: string;
}) {
  const { setNodeRef: rootDropRef, isOver: rootIsOver } = useDroppable({
    id: "kitfolder:root",
  });

  return (
    <div>
      <SectionLink
        href="/kits"
        label="Kits"
        icon={Palette}
        pathname={pathname}
        dropRef={rootDropRef}
        isDropTarget={rootIsOver}
      />
      {kitTree.length > 0 ? (
        <div className="mb-1 ml-3 mt-0.5 border-l border-border pl-1">
          {kitTree.map((node) => (
            <KitsTreeBranch key={node.id} node={node} depth={0} pathname={pathname} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function KitsNav({
  kitTree,
  pathname,
  canEdit,
}: {
  kitTree: NavTreeNode[];
  pathname: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const [activeKitId, setActiveKitId] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <div>
        <SectionLink href="/kits" label="Kits" icon={Palette} pathname={pathname} />
        {kitTree.length > 0 ? (
          <div className="mb-1 ml-3 mt-0.5 border-l border-border pl-1">
            {kitTree.map((node) => (
              <TreeBranch key={node.id} node={node} depth={0} pathname={pathname} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveKitId(null);
    const { active, over } = event;
    if (!over) return;
    const kitId = String(active.id).replace(/^kit:/, "");
    const target = String(over.id).replace(/^kitfolder:/, "");
    const result = await moveKitToFolder(kitId, target === "root" ? null : target);
    if (result.ok) {
      toast.success(target === "root" ? "Moved to Kits root" : "Kit moved");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to move kit");
    }
  }

  const activeNode = activeKitId ? findNode(kitTree, activeKitId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) =>
        setActiveKitId(String(event.active.id).replace(/^kit:/, ""))
      }
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => setActiveKitId(null)}
    >
      <KitsNavTreeArea kitTree={kitTree} pathname={pathname} />
      <DragOverlay>
        {activeNode ? (
          <div className="rounded-md border border-border bg-card px-3 py-1.5 text-[13px] shadow-lg">
            {activeNode.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
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
  const canEdit = role !== "viewer";

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
        <div>
          <SectionLink
            href="/brand"
            label="Brand Guide"
            icon={BookOpen}
            pathname={pathname}
          />
          {pathname.startsWith("/brand") ? (
            <div className="mb-1 ml-3 mt-0.5 border-l border-border pl-1">
              {BRAND_GUIDE_LINKS.map((link) => (
                <div key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "block truncate rounded-md py-1 pl-5 pr-2 text-[13px] transition-colors",
                      pathname.startsWith(link.href) &&
                        !("children" in link && pathname !== link.href)
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    {link.label}
                  </Link>
                  {"children" in link && pathname.startsWith(link.href)
                    ? link.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "block truncate rounded-md py-1 pl-9 pr-2 text-[13px] transition-colors",
                            pathname.startsWith(child.href)
                              ? "bg-accent font-medium text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                          )}
                        >
                          {child.label}
                        </Link>
                      ))
                    : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <SectionLink
            href="/photos"
            label="Photos"
            icon={Images}
            pathname={pathname}
          />
          {photoTree.length > 0 ? (
            <div className="mb-1 ml-3 mt-0.5 border-l border-border pl-1">
              {photoTree.map((node) => (
                <TreeBranch
                  key={node.id}
                  node={node}
                  depth={0}
                  pathname={pathname}
                />
              ))}
            </div>
          ) : null}
        </div>

        <KitsNav kitTree={kitTree} pathname={pathname} canEdit={canEdit} />

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
