"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Folder } from "lucide-react";
import { toast } from "sonner";
import { moveKitToFolder } from "@/lib/actions/kit-folders";
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
    </Link>
  );
}

function DraggableKitCard({
  kit,
  canShare,
}: {
  kit: DndKit;
  canShare: boolean;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `kit:${kit.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(isDragging && "opacity-40")}
    >
      <KitCard kit={kit} canShare={canShare} />
    </div>
  );
}

/**
 * Kit folder + kit grid with drag-and-drop: drag a kit card onto a folder
 * card to move it there. Falls back to a static grid for viewers.
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
  const [activeKitId, setActiveKitId] = useState<string | null>(null);

  async function handleDragEnd(event: DragEndEvent) {
    setActiveKitId(null);
    const { active, over } = event;
    if (!over) return;
    const kitId = String(active.id).replace(/^kit:/, "");
    const folderId = String(over.id).replace(/^folder:/, "");
    if (!kitId || !folderId) return;

    const result = await moveKitToFolder(kitId, folderId);
    if (result.ok) {
      const folder = folders.find((f) => f.id === folderId);
      toast.success(`Moved to ${folder?.name ?? "folder"}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to move kit");
    }
  }

  if (!canEdit) {
    return (
      <>
        {folders.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {folders.map((folder) => (
              <DroppableStaticFolder key={folder.id} folder={folder} />
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

  const activeKit = activeKitId
    ? kits.find((kit) => kit.id === activeKitId)
    : null;

  return (
    <DndContext
      sensors={sensors}
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

      {kits.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit) => (
            <DraggableKitCard key={kit.id} kit={kit} canShare />
          ))}
        </div>
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

function DroppableStaticFolder({ folder }: { folder: DndFolder }) {
  return (
    <Link
      href={`/kits/f/${folder.id}`}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40"
    >
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
    </Link>
  );
}
