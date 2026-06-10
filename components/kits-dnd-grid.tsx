"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Folder } from "lucide-react";
import { toast } from "sonner";
import { moveKitToFolder } from "@/lib/actions/kit-folders";
import { reorderKits } from "@/lib/actions/kits";
import { cn } from "@/lib/utils";
import { KitCard } from "@/components/kit-card";

export interface DndFolder {
  id: string;
  name: string;
  meta?: string;
}

export interface DndKit {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cover_image_id: string | null;
}

const gridCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

function FolderCardInner({ folder }: { folder: DndFolder }) {
  return (
    <>
      <Folder
        className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        strokeWidth={1.5}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{folder.name}</p>
        {folder.meta ? (
          <p className="text-xs text-muted-foreground">{folder.meta}</p>
        ) : null}
      </div>
    </>
  );
}

function DroppableFolderCard({ folder }: { folder: DndFolder }) {
  const { setNodeRef, isOver } = useDroppable({ id: `folder:${folder.id}` });

  return (
    <Link
      ref={setNodeRef}
      href={`/kits/f/${folder.id}`}
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors",
        isOver
          ? "border-foreground bg-accent"
          : "border-border hover:border-muted-foreground/40"
      )}
    >
      <FolderCardInner folder={folder} />
    </Link>
  );
}

function SortableKitCard({
  kit,
  canShare,
}: {
  kit: DndKit;
  canShare: boolean;
}) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `kit:${kit.id}` });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(isDragging && "z-10 opacity-40")}
    >
      <KitCard kit={kit} canShare={canShare} />
    </div>
  );
}

/**
 * Kit folder + kit grid: drag a kit onto a folder card to move it there,
 * or between kit cards to reorder. Static grid for viewers.
 */
export function KitsDndGrid({
  folders,
  kits,
  canEdit,
}: {
  folders: DndFolder[];
  kits: DndKit[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const kitById = useMemo(() => new Map(kits.map((k) => [k.id, k])), [kits]);
  const [order, setOrder] = useState(() => kits.map((k) => k.id));
  const [activeKitId, setActiveKitId] = useState<string | null>(null);

  const serverOrder = kits.map((k) => k.id).join(",");
  useEffect(() => {
    setOrder(serverOrder ? serverOrder.split(",") : []);
  }, [serverOrder]);

  async function handleDragEnd(event: DragEndEvent) {
    setActiveKitId(null);
    const { active, over } = event;
    if (!over) return;
    const kitId = String(active.id).replace(/^kit:/, "");
    const overId = String(over.id);

    // Drop on a folder card → move into that folder.
    if (overId.startsWith("folder:")) {
      const folderId = overId.replace(/^folder:/, "");
      const result = await moveKitToFolder(kitId, folderId);
      if (result.ok) {
        const folder = folders.find((f) => f.id === folderId);
        toast.success(`Moved to ${folder?.name ?? "folder"}`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to move kit");
      }
      return;
    }

    // Drop on another kit → reorder.
    const overKitId = overId.replace(/^kit:/, "");
    const fromIndex = order.indexOf(kitId);
    const toIndex = order.indexOf(overKitId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const next = arrayMove(order, fromIndex, toIndex);
    setOrder(next);
    const result = await reorderKits(
      next.map((id, index) => ({ kitId: id, sortOrder: index }))
    );
    if (!result.ok) toast.error(result.error ?? "Failed to save order");
    router.refresh();
  }

  const orderedKits = order
    .map((id) => kitById.get(id))
    .filter((kit): kit is DndKit => Boolean(kit));

  if (!canEdit) {
    return (
      <>
        {folders.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {folders.map((folder) => (
              <Link
                key={folder.id}
                href={`/kits/f/${folder.id}`}
                className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40"
              >
                <FolderCardInner folder={folder} />
              </Link>
            ))}
          </div>
        ) : null}
        {kits.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kits.map((kit) => (
              <KitCard key={kit.id} kit={kit} canShare={false} />
            ))}
          </div>
        ) : null}
      </>
    );
  }

  const activeKit = activeKitId ? kitById.get(activeKitId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={gridCollision}
      onDragStart={(event) =>
        setActiveKitId(String(event.active.id).replace(/^kit:/, ""))
      }
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => setActiveKitId(null)}
    >
      {folders.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {folders.map((folder) => (
            <DroppableFolderCard key={folder.id} folder={folder} />
          ))}
        </div>
      ) : null}

      {orderedKits.length > 0 ? (
        <SortableContext
          items={orderedKits.map((kit) => `kit:${kit.id}`)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orderedKits.map((kit) => (
              <SortableKitCard key={kit.id} kit={kit} canShare />
            ))}
          </div>
        </SortableContext>
      ) : null}

      <DragOverlay>
        {activeKit ? (
          <div className="w-56 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
            <p className="truncate text-sm font-medium">{activeKit.name}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
