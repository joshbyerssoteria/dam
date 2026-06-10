"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createKitSection,
  deleteKitSection,
  renameKitSection,
  reorderKitAssets,
  reorderKitSections,
} from "@/lib/actions/kits";
import { cn } from "@/lib/utils";
import {
  FileAssetCard,
  type FileAssetCardFile,
} from "@/components/file-asset-card";
import { KitFileUpload } from "@/components/kit-file-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const UNSECTIONED = "none";
const SECTION_PREFIX = "sec:";

// closestCorners misbehaves with adjacent grid containers — the container a
// drag started in keeps winning, so items can never leave it. Prefer
// whatever is directly under the pointer; fall back to rect overlap.
const boardCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

export interface BoardFile {
  kitAssetId: string;
  sectionId: string | null;
  file: FileAssetCardFile;
}

export interface BoardSection {
  id: string;
  name: string;
}

type SectionDialogState =
  | { mode: "create" }
  | { mode: "rename"; sectionId: string }
  | { mode: "name-unsectioned" }
  | null;

function SortableCard({ item }: { item: BoardFile }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.kitAssetId });

  // The whole card is the drag target — buttons inside still click fine
  // because the sensor only activates after 6px of movement.
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        "group/card relative cursor-grab active:cursor-grabbing",
        isDragging && "z-10 opacity-40"
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-1.5 top-1.5 z-10 rounded bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100"
      >
        <GripVertical className="size-3.5" />
      </span>
      <FileAssetCard kitAssetId={item.kitAssetId} file={item.file} canEdit />
    </div>
  );
}

function SectionBody({
  containerId,
  items,
}: {
  containerId: string;
  items: BoardFile[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: containerId });

  return (
    <SortableContext
      items={items.map((item) => item.kitAssetId)}
      strategy={rectSortingStrategy}
    >
      <div
        ref={setNodeRef}
        className={cn(
          "grid min-h-24 grid-cols-2 gap-3 rounded-lg p-1 transition-colors sm:grid-cols-3 lg:grid-cols-4",
          isOver && "bg-accent/50",
          items.length === 0 &&
            "items-center justify-center border border-dashed border-border"
        )}
      >
        {items.length === 0 ? (
          <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
            Drag files here
          </p>
        ) : (
          items.map((item) => <SortableCard key={item.kitAssetId} item={item} />)
        )}
      </div>
    </SortableContext>
  );
}

function SectionHeader({
  title,
  count,
  dragHandle,
  onRename,
  onDelete,
  renameLabel = "Rename section",
  actions,
}: {
  title: string;
  count: number;
  dragHandle?: React.ReactNode;
  onRename?: () => void;
  onDelete?: () => void;
  renameLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {dragHandle}
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <span className="text-xs text-muted-foreground/60">{count}</span>
      {actions}
      {onRename ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label={`Section ${title} actions`}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={onRename}>
              <Pencil className="size-4" />
              {renameLabel}
            </DropdownMenuItem>
            {onDelete ? (
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 className="size-4" />
                Delete section
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function SortableSection({
  kitId,
  section,
  items,
  onRename,
  onDelete,
}: {
  kitId: string;
  section: BoardSection;
  items: BoardFile[];
  onRename: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${SECTION_PREFIX}${section.id}` });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={section.name}
      className={cn(isDragging && "z-10 opacity-50")}
    >
      {/* The whole header row drags the section; menu clicks still work. */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <SectionHeader
          title={section.name}
          count={items.length}
          onRename={onRename}
          onDelete={onDelete}
          actions={
            <KitFileUpload
              kitId={kitId}
              sectionId={section.id}
              sectionName={section.name}
              variant="section"
            />
          }
          dragHandle={
            <span
              aria-hidden
              className="rounded p-0.5 text-muted-foreground/60"
            >
              <GripVertical className="size-3.5" />
            </span>
          }
        />
      </div>
      <SectionBody containerId={section.id} items={items} />
    </section>
  );
}

/**
 * Editable file area of a kit: named sections that can themselves be
 * drag-reordered, with files draggable within and across sections. The
 * unsectioned group can be "named" — which turns it into a real section.
 */
export function KitFileBoard({
  kitId,
  sections,
  files,
}: {
  kitId: string;
  sections: BoardSection[];
  files: BoardFile[];
}) {
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const fileByAssetId = useMemo(
    () => new Map(files.map((item) => [item.kitAssetId, item])),
    [files]
  );
  const sectionById = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections]
  );

  function initialContainers(): Record<string, string[]> {
    const result: Record<string, string[]> = { [UNSECTIONED]: [] };
    for (const section of sections) result[section.id] = [];
    for (const item of files) {
      const key =
        item.sectionId && result[item.sectionId] ? item.sectionId : UNSECTIONED;
      result[key]!.push(item.kitAssetId);
    }
    return result;
  }

  const [containers, setContainers] = useState<Record<string, string[]>>(
    initialContainers
  );
  const [sectionOrder, setSectionOrder] = useState<string[]>(() =>
    sections.map((section) => section.id)
  );
  const [active, setActive] = useState<
    { type: "asset"; id: string } | { type: "section"; id: string } | null
  >(null);
  const [sectionDialog, setSectionDialog] = useState<SectionDialogState>(null);
  const [sectionName, setSectionName] = useState("");
  const [savingSection, setSavingSection] = useState(false);

  const serverFingerprint = `${sections.map((s) => s.id).join(",")}|${files
    .map((f) => `${f.kitAssetId}:${f.sectionId}`)
    .join(",")}`;
  // Server data changed (upload, delete, refresh) — rebuild the board.
  useEffect(() => {
    setContainers(initialContainers());
    setSectionOrder(sections.map((section) => section.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverFingerprint]);

  function findContainer(id: string): string | undefined {
    if (id in containers) return id;
    return Object.keys(containers).find((key) => containers[key]!.includes(id));
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActive(
      id.startsWith(SECTION_PREFIX)
        ? { type: "section", id: id.slice(SECTION_PREFIX.length) }
        : { type: "asset", id }
    );
  }

  function handleDragOver(event: DragOverEvent) {
    const { active: dragActive, over } = event;
    if (!over) return;
    const activeId = String(dragActive.id);
    if (activeId.startsWith(SECTION_PREFIX)) return; // sections sort on drop

    const from = findContainer(activeId);
    const overId = String(over.id);
    const to = overId.startsWith(SECTION_PREFIX)
      ? overId.slice(SECTION_PREFIX.length)
      : findContainer(overId);
    if (!from || !to || from === to || !(to in containers)) return;

    setContainers((current) => {
      const fromItems = current[from]!.filter((id) => id !== activeId);
      const toItems = [...current[to]!];
      const overIndex = toItems.indexOf(overId);
      const insertAt = overIndex >= 0 ? overIndex : toItems.length;
      toItems.splice(insertAt, 0, activeId);
      return { ...current, [from]: fromItems, [to]: toItems };
    });
  }

  async function persistAssets(next: Record<string, string[]>) {
    const updates = Object.entries(next).flatMap(([key, ids]) =>
      ids.map((kitAssetId, index) => ({
        kitAssetId,
        sectionId: key === UNSECTIONED ? null : key,
        sortOrder: index,
      }))
    );
    const result = await reorderKitAssets(updates);
    if (!result.ok) toast.error(result.error ?? "Failed to save arrangement");
    router.refresh();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active: dragActive, over } = event;
    setActive(null);
    if (!over) return;
    const activeId = String(dragActive.id);
    const overId = String(over.id);

    // Section reorder
    if (activeId.startsWith(SECTION_PREFIX)) {
      if (!overId.startsWith(SECTION_PREFIX) || activeId === overId) return;
      const fromIndex = sectionOrder.indexOf(activeId.slice(SECTION_PREFIX.length));
      const toIndex = sectionOrder.indexOf(overId.slice(SECTION_PREFIX.length));
      if (fromIndex < 0 || toIndex < 0) return;
      const next = arrayMove(sectionOrder, fromIndex, toIndex);
      setSectionOrder(next);
      const result = await reorderKitSections(
        next.map((sectionId, index) => ({ sectionId, sortOrder: index }))
      );
      if (!result.ok) toast.error(result.error ?? "Failed to save section order");
      router.refresh();
      return;
    }

    // Asset reorder within its (possibly new) container
    const container = findContainer(activeId);
    if (!container) return;
    let next = containers;
    const items = containers[container]!;
    const fromIndex = items.indexOf(activeId);
    const toIndex = items.indexOf(overId);
    if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
      next = { ...containers, [container]: arrayMove(items, fromIndex, toIndex) };
      setContainers(next);
    }
    await persistAssets(next);
  }

  async function handleSectionSave() {
    if (!sectionDialog) return;
    setSavingSection(true);

    if (sectionDialog.mode === "rename") {
      const result = await renameKitSection(sectionDialog.sectionId, sectionName);
      setSavingSection(false);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to rename");
        return;
      }
    } else {
      // create / name-unsectioned
      const result = await createKitSection(kitId, sectionName);
      if (!result.ok) {
        setSavingSection(false);
        toast.error(result.error);
        return;
      }
      if (sectionDialog.mode === "name-unsectioned") {
        // Naming the unsectioned group = move its files into the new section.
        const unsectionedIds = containers[UNSECTIONED] ?? [];
        const moveResult = await reorderKitAssets(
          unsectionedIds.map((kitAssetId, index) => ({
            kitAssetId,
            sectionId: result.sectionId,
            sortOrder: index,
          }))
        );
        if (!moveResult.ok) {
          setSavingSection(false);
          toast.error(moveResult.error ?? "Failed to move files");
          return;
        }
      }
      setSavingSection(false);
    }

    setSectionDialog(null);
    setSectionName("");
    router.refresh();
  }

  async function handleSectionDelete(sectionId: string) {
    const result = await deleteKitSection(sectionId);
    if (result.ok) {
      toast.success("Section deleted — its files are now unsectioned");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to delete section");
    }
  }

  const orderedSections = sectionOrder
    .map((id) => sectionById.get(id))
    .filter((section): section is BoardSection => Boolean(section));
  const unsectionedItems = (containers[UNSECTIONED] ?? [])
    .map((id) => fileByAssetId.get(id))
    .filter((item): item is BoardFile => Boolean(item));
  const showUnsectioned = sections.length === 0 || unsectionedItems.length > 0;

  return (
    <div className="space-y-8">
      <DndContext
        sensors={sensors}
        collisionDetection={boardCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={(event) => void handleDragEnd(event)}
      >
        {showUnsectioned ? (
          <section aria-label="Unsectioned files">
            <SectionHeader
              title={sections.length === 0 ? "Files" : "Unsectioned"}
              count={unsectionedItems.length}
              onRename={
                unsectionedItems.length > 0
                  ? () => {
                      setSectionName("");
                      setSectionDialog({ mode: "name-unsectioned" });
                    }
                  : undefined
              }
              renameLabel="Name this section"
              actions={<KitFileUpload kitId={kitId} variant="section" />}
            />
            <SectionBody containerId={UNSECTIONED} items={unsectionedItems} />
          </section>
        ) : null}

        <SortableContext
          items={orderedSections.map((section) => `${SECTION_PREFIX}${section.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-8">
            {orderedSections.map((section) => (
              <SortableSection
                key={section.id}
                kitId={kitId}
                section={section}
                items={(containers[section.id] ?? [])
                  .map((id) => fileByAssetId.get(id))
                  .filter((item): item is BoardFile => Boolean(item))}
                onRename={() => {
                  setSectionName(section.name);
                  setSectionDialog({ mode: "rename", sectionId: section.id });
                }}
                onDelete={() => void handleSectionDelete(section.id)}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {active?.type === "asset" && fileByAssetId.get(active.id) ? (
            <div className="w-48 rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
              <p className="truncate text-xs font-medium">
                {fileByAssetId.get(active.id)!.file.original_filename}
              </p>
            </div>
          ) : active?.type === "section" && sectionById.get(active.id) ? (
            <div className="rounded-lg border border-border bg-card px-4 py-2 shadow-lg">
              <p className="text-xs font-medium uppercase tracking-wide">
                {sectionById.get(active.id)!.name}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setSectionName("");
          setSectionDialog({ mode: "create" });
        }}
      >
        <Plus className="size-4" />
        Add section
      </Button>

      <Dialog
        open={sectionDialog !== null}
        onOpenChange={(open) => !open && setSectionDialog(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {sectionDialog?.mode === "rename"
                ? "Rename section"
                : sectionDialog?.mode === "name-unsectioned"
                  ? "Name this section"
                  : "New section"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (sectionName.trim()) void handleSectionSave();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="section-name">Name</Label>
              <Input
                id="section-name"
                autoFocus
                value={sectionName}
                onChange={(event) => setSectionName(event.target.value)}
                placeholder="Social Media"
              />
            </div>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={savingSection || !sectionName.trim()}>
                {savingSection ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
