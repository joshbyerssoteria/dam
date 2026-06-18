"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
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
  FolderKanban,
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
import { moveFolder } from "@/lib/actions/folders";
import { moveProject } from "@/lib/actions/projects";
import { reorderKits } from "@/lib/actions/kits";
import { org } from "@/lib/config";
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

const SECONDARY_NAV = [
  { href: "/shares", label: "Share Links", icon: Link2, roles: ["admin", "editor"] },
  { href: "/upload-links", label: "Upload Links", icon: UploadCloud, roles: ["admin"] },
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
        // Focus draws one gold ring around the whole row (brand guide →
        // Application UI) — the inner link's own outline is suppressed.
        "group flex items-center rounded-md transition-colors has-[a:focus-visible]:ring-1 has-[a:focus-visible]:ring-ring",
        active
          ? "bg-[#F2EEE7] font-medium text-foreground"
          : "text-muted-foreground hover:bg-[#F2EEE7]/70 hover:text-foreground",
        // Unmistakable drop target: gold fill, inset ring, white ink.
        isDropTarget &&
          "bg-[#C2912D] font-medium text-white ring-2 ring-[#C2912D] ring-offset-1"
      )}
      style={{ paddingLeft: `${depth * 12}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          onClick={onToggle}
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-[#1B2A41]/5"
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
        className="flex min-w-0 flex-1 items-center gap-1.5 truncate py-1 pr-2 text-[13px] focus-visible:outline-none"
        title={node.name}
      >
        {node.variant === "sermon_series" ? (
          <BookOpen className="size-3.5 shrink-0" strokeWidth={1.75} />
        ) : null}
        <span className="truncate">{node.name}</span>
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
  const [expanded, setExpanded] = useState(false);

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
 * Photo-folder tree branch with drag-and-drop: every folder is both a drag
 * source (move it elsewhere) and a drop target (nest another folder under
 * it). Dropping onto the Photos header moves a folder to the root.
 */
function PhotoTreeBranch({
  node,
  depth,
  pathname,
}: {
  node: NavTreeNode;
  depth: number;
  pathname: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `photofolder:${node.id}`,
  });
  const {
    setNodeRef: setDragRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({ id: `photo:${node.id}` });

  // The ROW is both drag source and drop target. Children render OUTSIDE
  // this node so they don't inflate the drop zone (which made every drop
  // land on an ambiguous ancestor).
  const setRowRef = (element: HTMLElement | null) => {
    setDropRef(element);
    setDragRef(element);
  };

  return (
    <div>
      <div ref={setRowRef} className={cn(isDragging && "opacity-30")}>
        <BranchRow
          node={node}
          depth={depth}
          pathname={pathname}
          expanded={expanded}
          onToggle={() => setExpanded((current) => !current)}
          onExpand={() => setExpanded((current) => !current)}
          isDropTarget={isOver && !isDragging}
          dragProps={{ ...attributes, ...listeners }}
        />
      </div>
      {node.children.length > 0 ? (
        <Collapse open={expanded}>
          <div>
            {node.children.map((child) => (
              <PhotoTreeBranch
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
 * Project tree branch: same drag-and-drop shape as PhotoTreeBranch, with
 * `projectdrag:`/`projectdrop:` ids so project moves never cross over into
 * folder moves inside the shared Photos DndContext.
 */
function ProjectTreeBranch({
  node,
  depth,
  pathname,
}: {
  node: NavTreeNode;
  depth: number;
  pathname: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `projectdrop:${node.id}`,
  });
  const {
    setNodeRef: setDragRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({ id: `projectdrag:${node.id}` });

  const setRowRef = (element: HTMLElement | null) => {
    setDropRef(element);
    setDragRef(element);
  };

  return (
    <div>
      <div ref={setRowRef} className={cn(isDragging && "opacity-30")}>
        <BranchRow
          node={node}
          depth={depth}
          pathname={pathname}
          expanded={expanded}
          onToggle={() => setExpanded((current) => !current)}
          onExpand={() => setExpanded((current) => !current)}
          isDropTarget={isOver && !isDragging}
          dragProps={{ ...attributes, ...listeners }}
        />
      </div>
      {node.children.length > 0 ? (
        <Collapse open={expanded}>
          <div>
            {node.children.map((child) => (
              <ProjectTreeBranch
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
  const [expanded, setExpanded] = useState(false);
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

  // The ROW is the drop zone (folders) / drag source (kits) — never the
  // whole subtree, so drops land on the row actually under the pointer.
  const setRowRef = (element: HTMLElement | null) => {
    if (isFolder) setDropRef(element);
    else setDragRef(element);
  };

  return (
    <div>
      <div
        ref={setRowRef}
        style={
          !isFolder
            ? { transform: CSS.Transform.toString(transform), transition }
            : undefined
        }
        className={cn(isDragging && "opacity-30")}
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
  expandable = false,
  expanded = false,
  onToggle,
}: {
  href: string;
  label: string;
  icon: typeof Images;
  pathname: string;
  dropRef?: (element: HTMLElement | null) => void;
  isDropTarget?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const sectionActive = pathname === href || pathname.startsWith(`${href}/`);
  const exactActive = sectionActive && pathname === href;
  // Active / hover / drop-target appearance for the whole row.
  const stateClasses = cn(
    exactActive
      ? "bg-[#F2EEE7] font-medium text-foreground"
      : "text-muted-foreground hover:bg-[#F2EEE7]/70 hover:text-foreground",
    sectionActive && !exactActive && "text-foreground",
    isDropTarget && "bg-[#F2EEE7] ring-1 ring-[#C2912D]"
  );

  if (!expandable) {
    return (
      <Link
        ref={dropRef as React.Ref<HTMLAnchorElement>}
        href={href}
        prefetch={true}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
          stateClasses
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} />
        {label}
      </Link>
    );
  }

  // Expandable: the highlight lives on the row so it wraps the chevron too
  // (Brand Guide pattern). The label still navigates + opens the section.
  return (
    <div
      className={cn(
        "flex items-center rounded-md transition-colors has-[a:focus-visible]:ring-1 has-[a:focus-visible]:ring-ring",
        stateClasses
      )}
    >
      <Link
        ref={dropRef as React.Ref<HTMLAnchorElement>}
        href={href}
        prefetch={true}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5 text-sm focus-visible:outline-none"
      >
        <Icon className="size-4" strokeWidth={1.75} />
        {label}
      </Link>
      <button
        type="button"
        aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
        onClick={onToggle}
        className="mr-1.5 flex size-5 shrink-0 items-center justify-center rounded hover:bg-[#1B2A41]/5"
      >
        <ChevronRight
          className={cn(
            "size-3 transition-transform duration-200",
            expanded && "rotate-90"
          )}
        />
      </button>
    </div>
  );
}

/** Rendered inside DndContext so the root droppable hook has a provider. */
function KitsNavTreeArea({
  kitTree,
  pathname,
  open,
  onToggle,
}: {
  kitTree: NavTreeNode[];
  pathname: string;
  open: boolean;
  onToggle: () => void;
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
        expandable
        expanded={open}
        onToggle={onToggle}
      />
      <Collapse open={open}>
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
      </Collapse>
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
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((current) => !current);

  if (!canEdit) {
    return (
      <div>
        <SectionLink
          href="/kits"
          label="Kits"
          icon={Palette}
          pathname={pathname}
          expandable
          expanded={open}
          onToggle={toggle}
        />
        <Collapse open={open}>
          {kitTree.length > 0 ? (
            <div className="mb-1 ml-3 mt-0.5 border-l border-border pl-1">
              {kitTree.map((node) => (
                <TreeBranch key={node.id} node={node} depth={0} pathname={pathname} />
              ))}
            </div>
          ) : null}
        </Collapse>
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

    // Dropped on another kit → reorder within the SAME folder only. A kit
    // never changes folders by landing on another kit (that orphaned kits);
    // moving between folders is done by dropping on a folder row above.
    const overKitId = overId.replace(/^kit:/, "");
    const groups = new Map<string, KitGroup>();
    buildKitGroups(kitTree, null, groups);
    const activeGroup = groups.get(kitId);
    const overGroup = groups.get(overKitId);
    if (!activeGroup || !overGroup || kitId === overKitId) return;
    if (activeGroup.parentId !== overGroup.parentId) return;

    const next = arrayMove(
      activeGroup.siblings,
      activeGroup.siblings.indexOf(kitId),
      activeGroup.siblings.indexOf(overKitId)
    );
    const updates = next.map((id, index) => ({ kitId: id, sortOrder: index }));

    const result = await reorderKits(updates);
    if (!result.ok) toast.error(result.error ?? "Failed to save order");
    router.refresh();
  }

  const activeNode = activeKitId ? findNode(kitTree, activeKitId) : null;

  return (
    <DndContext
      id="sidebar-kits-dnd"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(event) =>
        setActiveKitId(String(event.active.id).replace(/^kit:/, ""))
      }
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => setActiveKitId(null)}
    >
      <KitsNavTreeArea
        kitTree={kitTree}
        pathname={pathname}
        open={open}
        onToggle={toggle}
      />
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
 * Collapsible Projects group: pinned link + chevron (Brand Guide pattern),
 * with the project tree inside. In edit mode the link doubles as the
 * move-to-root drop target and branches are draggable.
 */
function ProjectsGroup({
  projectTree,
  pathname,
  draggable = false,
  dropRef,
  isDropTarget = false,
}: {
  projectTree: NavTreeNode[];
  pathname: string;
  draggable?: boolean;
  dropRef?: (element: HTMLElement | null) => void;
  isDropTarget?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasProjects = projectTree.length > 0;
  const Branch = draggable ? ProjectTreeBranch : TreeBranch;

  return (
    <div>
      <div
        className={cn(
          "flex items-center rounded-md transition-colors has-[a:focus-visible]:ring-1 has-[a:focus-visible]:ring-ring",
          pathname === "/photos/projects"
            ? "bg-[#F2EEE7] font-medium text-foreground"
            : "text-muted-foreground hover:bg-[#F2EEE7]/70 hover:text-foreground",
          isDropTarget &&
            "bg-[#C2912D] font-medium text-white ring-2 ring-[#C2912D] ring-offset-1"
        )}
      >
        <Link
          ref={dropRef as React.Ref<HTMLAnchorElement>}
          href="/photos/projects"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-1.5 truncate py-1 pl-5 pr-2 text-[13px] focus-visible:outline-none"
        >
          <FolderKanban className="size-3" />
          Projects
        </Link>
        {hasProjects ? (
          <button
            type="button"
            aria-label={open ? "Collapse Projects" : "Expand Projects"}
            onClick={() => setOpen((current) => !current)}
            className="mr-1.5 flex size-5 shrink-0 items-center justify-center rounded hover:bg-[#1B2A41]/5"
          >
            <ChevronRight
              className={cn(
                "size-3 transition-transform duration-200",
                open && "rotate-90"
              )}
            />
          </button>
        ) : null}
      </div>
      {hasProjects ? (
        <Collapse open={open}>
          <div>
            {projectTree.map((node) => (
              <Branch key={node.id} node={node} depth={1} pathname={pathname} />
            ))}
          </div>
        </Collapse>
      ) : null}
    </div>
  );
}

/** Photos header + favorites + projects + tree, with the root as a drop target. */
function PhotosNavArea({
  photoTree,
  projectTree,
  pathname,
  open,
  onToggle,
}: {
  photoTree: NavTreeNode[];
  projectTree: NavTreeNode[];
  pathname: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { setNodeRef: rootDropRef, isOver } = useDroppable({
    id: "photofolder:root",
  });
  const { setNodeRef: projectsRootDropRef, isOver: projectsRootIsOver } =
    useDroppable({ id: "projectdrop:root" });
  return (
    <div>
      <SectionLink
        href="/photos"
        label="Photos"
        icon={Images}
        pathname={pathname}
        dropRef={rootDropRef}
        isDropTarget={isOver}
        expandable
        expanded={open}
        onToggle={onToggle}
      />
      <Collapse open={open}>
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
          {/* Dropping a project on the header moves it back to the top level. */}
          <ProjectsGroup
            projectTree={projectTree}
            pathname={pathname}
            draggable
            dropRef={projectsRootDropRef}
            isDropTarget={projectsRootIsOver}
          />
        </div>
        {photoTree.length > 0 ? (
          <div className="mb-1 ml-3 mt-0.5 border-l border-border pl-1">
            {photoTree.map((node) => (
              <PhotoTreeBranch key={node.id} node={node} depth={0} pathname={pathname} />
            ))}
          </div>
        ) : null}
      </Collapse>
    </div>
  );
}

function PhotosNav({
  photoTree,
  projectTree,
  pathname,
  canEdit,
}: {
  photoTree: NavTreeNode[];
  projectTree: NavTreeNode[];
  pathname: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  // Full dnd id (with prefix) so the overlay knows which tree to search.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((current) => !current);

  if (!canEdit) {
    return (
      <div>
        <SectionLink
          href="/photos"
          label="Photos"
          icon={Images}
          pathname={pathname}
          expandable
          expanded={open}
          onToggle={toggle}
        />
        <Collapse open={open}>
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
            <ProjectsGroup projectTree={projectTree} pathname={pathname} />
          </div>
          {photoTree.length > 0 ? (
            <div className="mb-1 ml-3 mt-0.5 border-l border-border pl-1">
              {photoTree.map((node) => (
                <TreeBranch key={node.id} node={node} depth={0} pathname={pathname} />
              ))}
            </div>
          ) : null}
        </Collapse>
      </div>
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);

    // Folder dragged — only folder rows (and the Photos header) accept it.
    if (activeKey.startsWith("photo:")) {
      if (!overKey.startsWith("photofolder:")) return;
      const folderId = activeKey.replace(/^photo:/, "");
      const target = overKey.replace(/^photofolder:/, "");
      if (folderId === target) return;

      const result = await moveFolder(folderId, target === "root" ? null : target);
      if (result.ok) {
        if (!result.unchanged) {
          toast.success(target === "root" ? "Moved to top level" : "Folder moved");
          router.refresh();
        }
      } else {
        toast.error(result.error ?? "Failed to move folder");
      }
      return;
    }

    // Project dragged — only project rows (and the Projects header) accept it.
    if (activeKey.startsWith("projectdrag:")) {
      if (!overKey.startsWith("projectdrop:")) return;
      const projectId = activeKey.replace(/^projectdrag:/, "");
      const target = overKey.replace(/^projectdrop:/, "");
      if (projectId === target) return;

      const result = await moveProject(projectId, target === "root" ? null : target);
      if (result.ok) {
        if (!result.unchanged) {
          toast.success(target === "root" ? "Moved to top level" : "Project moved");
          router.refresh();
        }
      } else {
        toast.error(result.error ?? "Failed to move project");
      }
    }
  }

  const activeNode = activeId
    ? activeId.startsWith("projectdrag:")
      ? findNode(projectTree, activeId.replace(/^projectdrag:/, ""))
      : findNode(photoTree, activeId.replace(/^photo:/, ""))
    : null;

  return (
    <DndContext
      id="sidebar-photos-dnd"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => setActiveId(null)}
    >
      <PhotosNavArea
        photoTree={photoTree}
        projectTree={projectTree}
        pathname={pathname}
        open={open}
        onToggle={toggle}
      />
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
  const [open, setOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);

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
          "flex items-center rounded-md transition-colors duration-150 has-[a:focus-visible]:ring-1 has-[a:focus-visible]:ring-ring",
          sectionActive
            ? "text-foreground"
            : "text-muted-foreground hover:bg-[#F2EEE7]/70 hover:text-foreground"
        )}
      >
        <Link
          href="/brand"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5 text-sm focus-visible:outline-none"
        >
          <BookOpen className="size-4" strokeWidth={1.75} />
          Brand Guide
        </Link>
        <button
          type="button"
          aria-label={open ? "Collapse Brand Guide" : "Expand Brand Guide"}
          onClick={() => setOpen((current) => !current)}
          className="mr-1.5 flex size-5 shrink-0 items-center justify-center rounded hover:bg-[#1B2A41]/5"
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
          {subLink("/brand/application", "Application UI", "pl-5")}
          <div
            className={cn(
              "flex items-center rounded-md transition-colors duration-150 has-[a:focus-visible]:ring-1 has-[a:focus-visible]:ring-ring",
              pathname.startsWith("/brand/examples")
                ? "text-foreground"
                : "text-muted-foreground hover:bg-[#F2EEE7]/70 hover:text-foreground"
            )}
          >
            <Link
              href="/brand/examples/compositions"
              onClick={() => setExamplesOpen((current) => !current)}
              className="min-w-0 flex-1 truncate py-1 pl-5 pr-2 text-[13px] focus-visible:outline-none"
            >
              Examples
            </Link>
            <button
              type="button"
              aria-label={examplesOpen ? "Collapse Examples" : "Expand Examples"}
              onClick={() => setExamplesOpen((current) => !current)}
              className="mr-1.5 flex size-5 shrink-0 items-center justify-center rounded hover:bg-[#1B2A41]/5"
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

/**
 * Two-letter initials per the Brand Guide avatar spec: first + last word of
 * the display name, falling back to the email's local part.
 */
function initialsFor(displayName: string | null | undefined, email: string): string {
  const source =
    displayName?.trim() ||
    (email.split("@")[0] ?? "").replace(/[._-]+/g, " ").trim();
  const words = source.split(/\s+/).filter(Boolean);
  const first = words[0];
  const last = words[words.length - 1];
  if (!first) return "?";
  const letters =
    words.length >= 2 && last ? `${first[0]}${last[0]}` : first.slice(0, 2);
  return letters.toUpperCase();
}

export function AppSidebar({
  role,
  email,
  displayName,
  photoTree,
  projectTree,
  kitTree,
}: {
  role: AppRole;
  email: string;
  displayName?: string | null;
  photoTree: NavTreeNode[];
  projectTree: NavTreeNode[];
  kitTree: NavTreeNode[];
}) {
  const pathname = usePathname();
  const canEdit = role !== "viewer";
  const initials = initialsFor(displayName, email);

  return (
    <aside className="sticky top-0 flex h-svh w-60 shrink-0 flex-col border-r border-border bg-white">
      {/* 22px = nav container (12px) + item padding (10px), so the logo
          aligns with the menu items' content edge. 88px matches PageHeader
          height so page titles center with the logo. */}
      <div className="flex h-[88px] items-center px-[22px]">
        <Link href="/" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img
            src={org.logoPath}
            alt={org.fullName}
            className="h-auto w-[178px]"
            draggable={false}
          />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <SectionLink href="/search" label="Search Photos" icon={Search} pathname={pathname} />

        {org.brandGuideEnabled ? <BrandGuideNav pathname={pathname} /> : null}

        <PhotosNav
          photoTree={photoTree}
          projectTree={projectTree}
          pathname={pathname}
          canEdit={canEdit}
        />

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
              {/* Brand avatar: circular two-letter initials on a 20% gold
                  tint with navy ink — never a solid gold fill. */}
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#C2912D]/20 text-xs font-bold text-[#1B2A41]">
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground" title={email}>
                  {displayName?.trim() || email}
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
