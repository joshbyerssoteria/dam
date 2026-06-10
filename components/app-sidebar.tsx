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
  ChevronsUpDown,
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
  { href: "/shares", label: "Share links", icon: Link2, roles: ["admin", "editor"] },
  { href: "/upload-links", label: "Upload links", icon: UploadCloud, roles: ["admin"] },
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
          ? "bg-white font-medium text-foreground"
          : "text-muted-foreground hover:bg-white/60 hover:text-foreground",
        isDropTarget && "bg-white ring-1 ring-[#C2912D]"
      )}
      style={{
        paddingLeft: `${depth * 12}px`,
        ...(active ? { boxShadow: `inset 2px 0 0 ${GOLD}` } : {}),
      }}
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
  const exactActive = sectionActive && pathname === href;
  return (
    <Link
      ref={dropRef as React.Ref<HTMLAnchorElement>}
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        exactActive
          ? "bg-white font-medium text-foreground"
          : "text-muted-foreground hover:bg-white/60 hover:text-foreground",
        sectionActive && !exactActive && "text-foreground",
        isDropTarget && "bg-white ring-1 ring-[#C2912D]"
      )}
      style={exactActive ? { boxShadow: `inset 2px 0 0 ${GOLD}` } : undefined}
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
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <aside className="sticky top-0 flex h-svh w-60 shrink-0 flex-col border-r border-border bg-[#F2EEE7]">
      <div className="px-5 pb-6 pt-6">
        <Link href="/photos" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img
            src="/branding/logos/horizontal-navy.svg"
            alt="Soteria Church"
            className="h-7 w-auto"
            draggable={false}
          />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <SectionLink href="/search" label="Search" icon={Search} pathname={pathname} />

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
                        ? "bg-white font-medium text-foreground"
                        : "text-muted-foreground hover:bg-white/60 hover:text-foreground"
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
                              ? "bg-white font-medium text-foreground"
                              : "text-muted-foreground hover:bg-white/60 hover:text-foreground"
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
                    ? "bg-white font-medium text-foreground"
                    : "text-muted-foreground hover:bg-white/60 hover:text-foreground"
                )}
                style={active ? { boxShadow: `inset 2px 0 0 ${GOLD}` } : undefined}
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
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/60"
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
