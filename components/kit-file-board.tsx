"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  getFirstCollision,
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
  FolderOutput,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  convertSectionToKit,
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
import { uploadWithProgress } from "@/components/upload-dropzone";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNSECTIONED = "none";
const SECTION_PREFIX = "sec:";

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
  onDropFiles,
}: {
  containerId: string;
  items: BoardFile[];
  onDropFiles: (containerId: string, files: FileList) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: containerId });
  // Native OS file drags (e.g. from Finder) are separate from the pointer-based
  // @dnd-kit card sorting, so they get their own hover state.
  const [fileOver, setFileOver] = useState(false);

  return (
    <SortableContext
      items={items.map((item) => item.kitAssetId)}
      strategy={rectSortingStrategy}
    >
      <div
        ref={setNodeRef}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setFileOver(true);
        }}
        onDragLeave={(event) => {
          // Ignore leave events fired when crossing onto a child element.
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setFileOver(false);
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setFileOver(false);
          onDropFiles(containerId, event.dataTransfer.files);
        }}
        className={cn(
          "grid min-h-24 grid-cols-2 gap-3 p-1 transition-colors sm:grid-cols-3 lg:grid-cols-4",
          (isOver || fileOver) && "bg-accent/50",
          fileOver && "rounded-sm ring-2 ring-inset ring-foreground",
          items.length === 0 &&
            "items-center justify-center border border-dashed border-border"
        )}
      >
        {items.length === 0 ? (
          <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
            {fileOver ? "Drop to upload" : "Drag files here"}
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
  onConvert,
  renameLabel = "Rename section",
  actions,
}: {
  title: string;
  count: number;
  dragHandle?: React.ReactNode;
  onRename?: () => void;
  onDelete?: () => void;
  onConvert?: () => void;
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
            {onConvert ? (
              <DropdownMenuItem onSelect={onConvert}>
                <FolderOutput className="size-4" />
                Convert to its own kit…
              </DropdownMenuItem>
            ) : null}
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
  onConvert,
  onDropFiles,
}: {
  kitId: string;
  section: BoardSection;
  items: BoardFile[];
  onRename: () => void;
  onDelete: () => void;
  onConvert: () => void;
  onDropFiles: (containerId: string, files: FileList) => void;
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
          onConvert={onConvert}
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
      <SectionBody
        containerId={section.id}
        items={items}
        onDropFiles={onDropFiles}
      />
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
  folders,
}: {
  kitId: string;
  sections: BoardSection[];
  files: BoardFile[];
  folders: Array<{ id: string; name: string }>;
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
  const [convertSection, setConvertSection] = useState<BoardSection | null>(null);
  const [convertFolderId, setConvertFolderId] = useState("__root__");
  const [converting, setConverting] = useState(false);

  const serverFingerprint = `${sections.map((s) => s.id).join(",")}|${files
    .map((f) => `${f.kitAssetId}:${f.sectionId}`)
    .join(",")}`;
  // Server data changed (upload, delete, refresh) — rebuild the board.
  useEffect(() => {
    setContainers(initialContainers());
    setSectionOrder(sections.map((section) => section.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverFingerprint]);

  function findContainerIn(
    map: Record<string, string[]>,
    id: string
  ): string | undefined {
    if (id in map) return id;
    return Object.keys(map).find((key) => map[key]!.includes(id));
  }

  function findContainer(id: string): string | undefined {
    return findContainerIn(containers, id);
  }

  // Pins the collision result to the active item for one frame right after a
  // cross-container move. Without this, dropping into an empty section grows
  // that section, the layout shift moves a different container under the
  // (stationary) pointer, the item flips back, and the two states oscillate
  // forever — React error #185 (max update depth). See @dnd-kit's
  // multiple-containers example.
  const lastOverId = useRef<string | null>(null);
  const recentlyMovedToNewContainer = useRef(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
  }, [containers]);

  const collisionDetection: CollisionDetection = useCallback(
    (collisionArgs) => {
      const activeId = String(collisionArgs.active.id);
      // Section drags use the simple pointer/rect approach (vertical list).
      if (activeId.startsWith(SECTION_PREFIX)) {
        const pointer = pointerWithin(collisionArgs);
        return pointer.length > 0 ? pointer : rectIntersection(collisionArgs);
      }

      const pointerIntersections = pointerWithin(collisionArgs);
      const intersections =
        pointerIntersections.length > 0
          ? pointerIntersections
          : rectIntersection(collisionArgs);
      let overId = getFirstCollision(intersections, "id");

      if (overId != null) {
        // When over a container (section body or its wrapper), narrow to the
        // closest card inside it so reordering within a section stays precise.
        const rawOver = String(overId).startsWith(SECTION_PREFIX)
          ? String(overId).slice(SECTION_PREFIX.length)
          : String(overId);
        const containerItems = containers[rawOver];
        if (containerItems && containerItems.length > 0) {
          const closest = closestCenter({
            ...collisionArgs,
            droppableContainers: collisionArgs.droppableContainers.filter(
              (container) => containerItems.includes(String(container.id))
            ),
          })[0]?.id;
          if (closest != null) overId = closest;
        }
        lastOverId.current = String(overId);
        return [{ id: overId }];
      }

      // Mid-move into a new container: keep returning the active id so the
      // collision can't snap back to the source and start oscillating.
      if (recentlyMovedToNewContainer.current) {
        lastOverId.current = activeId;
      }
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [containers]
  );

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

    const overId = String(over.id);
    const overContainer = overId.startsWith(SECTION_PREFIX)
      ? overId.slice(SECTION_PREFIX.length)
      : null;

    setContainers((current) => {
      // Re-derive both endpoints from the latest state. A stale render-time
      // closure can reference a container that was just rebuilt (e.g. right
      // after creating a section, when router.refresh() resets the board),
      // so resolving against `current` avoids touching a missing container.
      const from = findContainerIn(current, activeId);
      const to = overContainer ?? findContainerIn(current, overId);
      if (!from || !to || from === to) return current;
      if (!current[from] || !current[to]) return current;

      const fromItems = current[from].filter((id) => id !== activeId);
      // Filter activeId out of the target too, so a duplicate dragOver can't
      // insert the same asset twice (which would yield duplicate keys).
      const toItems = current[to].filter((id) => id !== activeId);
      const overIndex = toItems.indexOf(overId);
      const insertAt = overIndex >= 0 ? overIndex : toItems.length;
      toItems.splice(insertAt, 0, activeId);
      recentlyMovedToNewContainer.current = true;
      return { ...current, [from]: fromItems, [to]: toItems };
    });
  }

  // Native file drop (from Finder etc.) onto a section grid → upload there.
  async function handleDropFiles(containerId: string, fileList: FileList) {
    const files = [...fileList];
    if (files.length === 0) return;
    const sectionId = containerId === UNSECTIONED ? undefined : containerId;
    const intent =
      sectionId !== undefined
        ? ({ intent: "kit-file", kitId, sectionId } as const)
        : ({ intent: "kit-file", kitId } as const);

    const toastId = toast.loading(
      files.length === 1
        ? `Uploading ${files[0]!.name}…`
        : `Uploading ${files.length} files…`
    );
    let succeeded = 0;
    // Sequential keeps memory predictable for large batches.
    for (const file of files) {
      const result = await uploadWithProgress(file, intent, () => {});
      if (result.ok) succeeded += 1;
      else toast.error(`${file.name}: ${result.error ?? "Upload failed"}`);
    }
    toast.dismiss(toastId);
    if (succeeded > 0) {
      toast.success(
        succeeded === 1 ? "1 file uploaded" : `${succeeded} files uploaded`
      );
      router.refresh();
    }
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
    const items = containers[container];
    if (items) {
      const fromIndex = items.indexOf(activeId);
      const toIndex = items.indexOf(overId);
      if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
        next = { ...containers, [container]: arrayMove(items, fromIndex, toIndex) };
        setContainers(next);
      }
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

  async function handleConvert() {
    if (!convertSection) return;
    setConverting(true);
    const result = await convertSectionToKit(
      convertSection.id,
      convertFolderId === "__root__" ? null : convertFolderId
    );
    setConverting(false);
    if (result.ok) {
      toast.success(`"${convertSection.name}" is now its own kit`);
      setConvertSection(null);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to convert section");
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
        id="kit-file-board-dnd"
        sensors={sensors}
        collisionDetection={collisionDetection}
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
            <SectionBody
              containerId={UNSECTIONED}
              items={unsectionedItems}
              onDropFiles={handleDropFiles}
            />
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
                onConvert={() => {
                  setConvertFolderId("__root__");
                  setConvertSection(section);
                }}
                onDropFiles={handleDropFiles}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {active?.type === "asset" && fileByAssetId.get(active.id) ? (
            <div className="w-48 border border-border bg-card px-3 py-2 shadow-lg">
              <p className="truncate text-xs font-medium">
                {fileByAssetId.get(active.id)!.file.original_filename}
              </p>
            </div>
          ) : active?.type === "section" && sectionById.get(active.id) ? (
            <div className="border border-border bg-card px-4 py-2 shadow-lg">
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
        open={convertSection !== null}
        onOpenChange={(open) => !open && setConvertSection(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Convert &ldquo;{convertSection?.name}&rdquo; to its own kit
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The section&apos;s files (and its matching palette, if any) move
            into a new kit named after the section.
          </p>
          <div className="space-y-2">
            <Label>Destination folder</Label>
            <Select value={convertFolderId} onValueChange={setConvertFolderId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__root__">No folder (Kits root)</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={() => void handleConvert()} disabled={converting}>
              {converting ? "Converting…" : "Convert to kit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
