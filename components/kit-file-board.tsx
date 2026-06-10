"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createKitSection,
  deleteKitSection,
  renameKitSection,
  reorderKitAssets,
} from "@/lib/actions/kits";
import { cn } from "@/lib/utils";
import {
  FileAssetCard,
  type FileAssetCardFile,
} from "@/components/file-asset-card";
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

export interface BoardFile {
  kitAssetId: string;
  sectionId: string | null;
  file: FileAssetCardFile;
}

export interface BoardSection {
  id: string;
  name: string;
}

function SortableCard({
  item,
}: {
  item: BoardFile;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.kitAssetId });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-40")}
    >
      <button
        type="button"
        aria-label={`Drag ${item.file.original_filename}`}
        {...attributes}
        {...listeners}
        className="absolute left-1.5 top-1.5 z-10 cursor-grab rounded bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/card:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>
      <div className="group/card">
        <FileAssetCard
          kitAssetId={item.kitAssetId}
          file={item.file}
          canEdit
        />
      </div>
    </div>
  );
}

function SectionContainer({
  containerId,
  title,
  items,
  onRename,
  onDelete,
}: {
  containerId: string;
  title: string;
  items: BoardFile[];
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: containerId });

  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <span className="text-xs text-muted-foreground/60">{items.length}</span>
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
                Rename section
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 className="size-4" />
                Delete section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
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
    </section>
  );
}

/**
 * Editable file area of a kit: named sections with drag-and-drop between
 * and within them. Order and membership persist via reorderKitAssets.
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

  function initialContainers(): Record<string, string[]> {
    const result: Record<string, string[]> = { [UNSECTIONED]: [] };
    for (const section of sections) result[section.id] = [];
    for (const item of files) {
      const key = item.sectionId && result[item.sectionId] ? item.sectionId : UNSECTIONED;
      result[key]!.push(item.kitAssetId);
    }
    return result;
  }

  const [containers, setContainers] = useState<Record<string, string[]>>(
    initialContainers
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sectionDialog, setSectionDialog] = useState<
    { mode: "create" } | { mode: "rename"; sectionId: string; current: string } | null
  >(null);
  const [sectionName, setSectionName] = useState("");
  const [savingSection, setSavingSection] = useState(false);

  // Server data changed (upload, delete, refresh) — rebuild the board.
  useEffect(() => {
    setContainers(initialContainers());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.map((s) => s.id).join(","), files.map((f) => `${f.kitAssetId}:${f.sectionId}`).join(",")]);

  function findContainer(id: string): string | undefined {
    if (id in containers) return id;
    return Object.keys(containers).find((key) => containers[key]!.includes(id));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const from = findContainer(String(active.id));
    const to = findContainer(String(over.id));
    if (!from || !to || from === to) return;

    setContainers((current) => {
      const fromItems = current[from]!.filter((id) => id !== String(active.id));
      const toItems = [...current[to]!];
      const overIndex = toItems.indexOf(String(over.id));
      const insertAt = overIndex >= 0 ? overIndex : toItems.length;
      toItems.splice(insertAt, 0, String(active.id));
      return { ...current, [from]: fromItems, [to]: toItems };
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const container = findContainer(String(active.id));
    if (!container) return;

    let next = containers;
    const items = containers[container]!;
    const fromIndex = items.indexOf(String(active.id));
    const toIndex = items.indexOf(String(over.id));
    if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
      next = {
        ...containers,
        [container]: arrayMove(items, fromIndex, toIndex),
      };
      setContainers(next);
    }

    // Persist the full arrangement.
    const updates = Object.entries(next).flatMap(([key, ids]) =>
      ids.map((kitAssetId, index) => ({
        kitAssetId,
        sectionId: key === UNSECTIONED ? null : key,
        sortOrder: index,
      }))
    );
    const result = await reorderKitAssets(updates);
    if (!result.ok) {
      toast.error(result.error ?? "Failed to save arrangement");
    }
    router.refresh();
  }

  async function handleSectionSave() {
    if (!sectionDialog) return;
    setSavingSection(true);
    const result =
      sectionDialog.mode === "create"
        ? await createKitSection(kitId, sectionName)
        : await renameKitSection(sectionDialog.sectionId, sectionName);
    setSavingSection(false);
    if (result.ok) {
      setSectionDialog(null);
      setSectionName("");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to save section");
    }
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

  const activeItem = activeId ? fileByAssetId.get(activeId) : null;
  const showUnsectioned =
    sections.length === 0 || (containers[UNSECTIONED]?.length ?? 0) > 0;

  return (
    <div className="space-y-8">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {showUnsectioned ? (
          <SectionContainer
            containerId={UNSECTIONED}
            title={sections.length === 0 ? "Files" : "Unsectioned"}
            items={(containers[UNSECTIONED] ?? [])
              .map((id) => fileByAssetId.get(id))
              .filter((item): item is BoardFile => Boolean(item))}
          />
        ) : null}

        {sections.map((section) => (
          <SectionContainer
            key={section.id}
            containerId={section.id}
            title={section.name}
            items={(containers[section.id] ?? [])
              .map((id) => fileByAssetId.get(id))
              .filter((item): item is BoardFile => Boolean(item))}
            onRename={() => {
              setSectionName(section.name);
              setSectionDialog({
                mode: "rename",
                sectionId: section.id,
                current: section.name,
              });
            }}
            onDelete={() => void handleSectionDelete(section.id)}
          />
        ))}

        <DragOverlay>
          {activeItem ? (
            <div className="w-48 rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
              <p className="truncate text-xs font-medium">
                {activeItem.file.original_filename}
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
              {sectionDialog?.mode === "rename" ? "Rename section" : "New section"}
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
