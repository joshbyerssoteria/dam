"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BookOpen,
  ChevronRight,
  ChevronsUpDown,
  Heart,
  Images,
  LogOut,
  Palette,
  Search,
  Settings,
  Link2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { moveKitToFolder } from "@/lib/actions/kit-folders";
import { reorderKits } from "@/lib/actions/kits";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/database.types";
import type { NavTreeNode } from "@/lib/nav-tree";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* Soteria brand chrome: off-white warm ground, navy ink, gold rules. */
const GOLD = "#C2912D";

const SECONDARY_NAV = [
  { href: "/shares", label: "Share links", icon: Link2, roles: ["admin", "editor"] },
  { href: "/upload-links", label: "Upload links", icon: UploadCloud, roles: ["admin"] },
] as const;

/** Animated expand/collapse — content stays mounted so toggling is instant. */
function Collapse({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-200 ease-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

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
  onExpand,
  isDropTarget = false,
  dragProps,
}: {
  node: NavTreeNode;
  depth: number;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
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
          ? "bg-[#F2EEE7] font-medium text-foreground"
          : "text-muted-foreground hover:bg-[#F2EEE7]/70 hover:text-foreground",
        isDropTarget && "bg-[#F2EEE7] ring-1 ring-[#C2912D]"
      )}
      style={{ paddingLeft: `${depth * 12}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          onClick={onToggle}
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-black/5"
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
        onClick={onExpand}
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
        onExpand={() => setExpanded((current) => !current)}
      />
      {node.children.length > 0 ? (
        <Collapse open={expanded}>
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
        </Collapse>
      ) : null}
    </div>
  );
}

/**
 * Kits tree branch: kit leaves sort among siblings and drop onto folders;
 * folder rows accept drops. Kit children render inside a SortableContext.
 */
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
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `kit:${node.id}`,
    disabled: isFolder,
  });

  const folderChildren = node.children.filter((c) => c.kind === "folder");
  const kitChildren = node.children.filter((c) => c.kind === "leaf");

  return (
    <div ref={isFolder ? setDropRef : undefined}>
      <div
        ref={!isFolder ? setDragRef : undefined}
        style={
          !isFolder
            ? { transform: CSS.Transform.toString(transform), transition }
            : undefined
        }
        className={cn(isDragging && "opacity-40")}
      >
        <BranchRow
          node={node}
          depth={depth}
          pathname={pathname}
          expanded={expanded}
          onToggle={() => setExpanded((current) => !current)}
          onExpand={() => setExpanded((current) => !current)}
          isDropTarget={isFolder && isOver}
          dragProps={!isFolder ? { ...attributes, ...listeners } : undefined}
        />
      </div>
      {node.children.length > 0 ? (
        <Collapse open={expanded}>
          <div>
            {folderChildren.map((child) => (
              <KitsTreeBranch
                key={child.id}
                node={child}
                depth={depth + 1}
                pathname={pathname}
              />
            ))}
            <SortableContext
              items={kitChildren.map((child) => `kit:${child.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {kitChildren.map((child) => (
                <KitsTreeBranch
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  pathname={pathname}
                />
              ))}
            </SortableContext>
          </div>
        </Collapse>
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
  const exactActive = sectionActive && pathname === href;
  return (
    <Link
      ref={dropRef as React.Ref<HTMLAnchorElement>}
      href={href}
      prefetch={true}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        exactActive
          ? "bg-[#F2EEE7] font-medium text-foreground"
          : "text-muted-foreground hover:bg-[#F2EEE7]/70 hover:text-foreground",
        sectionActive && !exactActive && "text-foreground",
        isDropTarget && "bg-[#F2EEE7] ring-1 ring-[#C2912D]"
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
          {kitTree
            .filter((node) => node.kind === "folder")
            .map((node) => (
              <KitsTreeBranch key={node.id} node={node} depth={0} pathname={pathname} />
            ))}
          <SortableContext
            items={kitTree
              .filter((node) => node.kind === "leaf")
              .map((node) => `kit:${node.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {kitTree
              .filter((node) => node.kind === "leaf")
              .map((node) => (
                <KitsTreeBranch key={node.id} node={node} depth={0} pathname={pathname} />
              ))}
          </SortableContext>
        </div>
      ) : null}
    </div>
  );
}

interface KitGroup {
  parentId: string | null;
  siblings: string[]; // kit ids in display order
}

function buildKitGroups(
  nodes: NavTreeNode[],
  parentId: string | null,
  map: Map<string, KitGroup>
) {
  const kitIds = nodes
    .filter((node) => node.kind === "leaf")
    .map((node) => node.id);
  for (const node of nodes) {
    if (node.kind === "leaf") {
      map.set(node.id, { parentId, siblings: kitIds });
    } else {
      buildKitGroups(node.children, node.id, map);
    }
  }
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
    const overId = String(over.id);

    // Dropped on a folder row (or the Kits header) → move into it.
    if (overId.startsWith("kitfolder:")) {
      const target = overId.replace(/^kitfolder:/, "");
      const result = await moveKitToFolder(kitId, target === "root" ? null : target);
      if (result.ok) {
        toast.success(target === "root" ? "Moved to Kits root" : "Kit moved");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to move kit");
      }
      return;
    }

    // Dropped on another kit → reorder (same group) or move-and-position
    // (different group).
    const overKitId = overId.replace(/^kit:/, "");
    const groups = new Map<string, KitGroup>();
    buildKitGroups(kitTree, null, groups);
    const activeGroup = groups.get(kitId);
    const overGroup = groups.get(overKitId);
    if (!activeGroup || !overGroup || kitId === overKitId) return;

    let updates: Array<{ kitId: string; sortOrder: number; kitFolderId?: string | null }>;
    if (activeGroup.parentId === overGroup.parentId) {
      const next = arrayMove(
        activeGroup.siblings,
        activeGroup.siblings.indexOf(kitId),
        activeGroup.siblings.indexOf(overKitId)
      );
      updates = next.map((id, index) => ({ kitId: id, sortOrder: index }));
    } else {
      const next = overGroup.siblings.filter((id) => id !== kitId);
      next.splice(next.indexOf(overKitId), 0, kitId);
      updates = next.map((id, index) => ({
        kitId: id,
        sortOrder: index,
        ...(id === kitId ? { kitFolderId: overGroup.parentId } : {}),
      }));
    }

    const result = await reorderKits(updates);
    if (!result.ok) toast.error(result.error ?? "Failed to save order");
    router.refresh();
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

/**
 * Brand Guide group: expands instantly on click (no waiting on navigation)
 * with an animated submenu; Examples nests its own collapsible group.
 */
function BrandGuideNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(() => pathname.startsWith("/brand"));
  const [examplesOpen, setExamplesOpen] = useState(() =>
    pathname.startsWith("/brand/examples")
  );

  function subLink(href: string, label: string, indent: "pl-5" | "pl-9") {
    const active = pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={cn(
          "block truncate rounded-md py-1 pr-2 text-[13px] transition-colors duration-150",
          indent,
          active
            ? "bg-[#F2EEE7] font-medium text-foreground"
            : "text-muted-foreground hover:bg-[#F2EEE7]/70 hover:text-foreground"
        )}
      >
        {label}
      </Link>
    );
  }

  const sectionActive = pathname.startsWith("/brand");

  return (
    <div>
      <div
        className={cn(
          "flex items-center rounded-md transition-colors duration-150",
          sectionActive
            ? "text-foreground"
            : "text-muted-foreground hover:bg-[#F2EEE7]/70 hover:text-foreground"
        )}
      >
        <Link
          href="/brand"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5 text-sm"
        >
          <BookOpen className="size-4" strokeWidth={1.75} />
          Brand Guide
        </Link>
        <button
          type="button"
          aria-label={open ? "Collapse Brand Guide" : "Expand Brand Guide"}
          onClick={() => setOpen((current) => !current)}
          className="mr-1.5 flex size-5 shrink-0 items-center justify-center rounded hover:bg-black/5"
        >
          <ChevronRight
            className={cn(
              "size-3 transition-transform duration-200",
              open && "rotate-90"
            )}
          />
        </button>
      </div>
      <Collapse open={open}>
        <div className="mb-1 ml-3 mt-0.5 border-l border-border pl-1">
          {subLink("/brand/logos", "Logos", "pl-5")}
          {subLink("/brand/colors", "Colors", "pl-5")}
          {subLink("/brand/typography", "Typography", "pl-5")}
          <div
            className={cn(
              "flex items-center rounded-md transition-colors duration-150",
              pathname.startsWith("/brand/examples")
                ? "text-foreground"
                : "text-muted-foreground hover:bg-[#F2EEE7]/70 hover:text-foreground"
            )}
          >
            <Link
              href="/brand/examples/compositions"
              onClick={() => setExamplesOpen((current) => !current)}
              className="min-w-0 flex-1 truncate py-1 pl-5 pr-2 text-[13px]"
            >
              Examples
            </Link>
            <button
              type="button"
              aria-label={examplesOpen ? "Collapse Examples" : "Expand Examples"}
              onClick={() => setExamplesOpen((current) => !current)}
              className="mr-1.5 flex size-5 shrink-0 items-center justify-center rounded hover:bg-black/5"
            >
              <ChevronRight
                className={cn(
                  "size-3 transition-transform duration-200",
                  examplesOpen && "rotate-90"
                )}
              />
            </button>
          </div>
          <Collapse open={examplesOpen}>
            <div>
              {subLink("/brand/examples/compositions", "Compositions", "pl-9")}
              {subLink("/brand/examples/blocks", "Blocks", "pl-9")}
              {subLink("/brand/examples/components", "Components", "pl-9")}
              {subLink("/brand/examples/slides", "Slides", "pl-9")}
            </div>
          </Collapse>
        </div>
      </Collapse>
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
  const canEdit = role !== "viewer";
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <aside className="sticky top-0 flex h-svh w-60 shrink-0 flex-col border-r border-border bg-white">
      {/* 22px = nav container (12px) + item padding (10px), so the logo
          aligns with the menu items' content edge. 88px matches PageHeader
          height so page titles center with the logo. */}
      <div className="flex h-[88px] items-center px-[22px]">
        <Link href="/photos" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img
            src="/branding/logos/horizontal-navy.svg"
            alt="Soteria Church"
            className="h-auto w-full"
            draggable={false}
          />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <SectionLink href="/search" label="Search" icon={Search} pathname={pathname} />

        <BrandGuideNav pathname={pathname} />

        <div>
          <SectionLink
            href="/photos"
            label="Photos"
            icon={Images}
            pathname={pathname}
          />
          <div className="mb-0.5 ml-3 mt-0.5 border-l border-border pl-1">
            <Link
              href="/photos/favorites"
              className={cn(
                "flex items-center gap-1.5 truncate rounded-md py-1 pl-5 pr-2 text-[13px] transition-colors",
                pathname === "/photos/favorites"
                  ? "bg-[#F2EEE7] font-medium text-foreground"
                  : "text-muted-foreground hover:bg-[#F2EEE7]/70 hover:text-foreground"
              )}
            >
              <Heart className="size-3" />
              Favorites
            </Link>
          </div>
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
                    ? "bg-[#F2EEE7] font-medium text-foreground"
                    : "text-muted-foreground hover:bg-[#F2EEE7]/70 hover:text-foreground"
                )}
              >
                <item.icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-[#F2EEE7]/70"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: GOLD }}
              >
                {initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground" title={email}>
                  {email}
                </span>
                <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                  {role}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="size-4" />
                Profile &amp; settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action="/auth/signout" method="post">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
