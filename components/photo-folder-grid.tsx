"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Folder } from "lucide-react";
import { toast } from "sonner";
import { moveFolder } from "@/lib/actions/folders";
import { cn } from "@/lib/utils";

export interface FolderGridItem {
  id: string;
  name: string;
  photoCount: number;
  subfolderCount: number;
}

/**
 * Grid of photo folders that can be dragged into one another to re-nest.
 * Editors get drag-and-drop (drop a folder card onto another to move it
 * inside); viewers get plain links.
 */
export function PhotoFolderGrid({
  folders,
  canEdit,
}: {
  folders: FolderGridItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const folderId = String(active.id).replace(/^folder:/, "");
    const targetId = String(over.id).replace(/^folder:/, "");
    if (folderId === targetId) return;

    const result = await moveFolder(folderId, targetId);
    if (result.ok) {
      if (!result.unchanged) {
        const target = folders.find((f) => f.id === targetId);
        toast.success(`Moved into ${target?.name ?? "folder"}`);
        router.refresh();
      }
    } else {
      toast.error(result.error ?? "Failed to move folder");
    }
  }

  if (!canEdit) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {folders.map((folder) => (
          <StaticFolderCard key={folder.id} folder={folder} />
        ))}
      </div>
    );
  }

  const activeFolder = activeId
    ? folders.find((f) => f.id === activeId)
    : null;

  return (
    <DndContext
      id="photo-folder-grid-dnd"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(event) =>
        setActiveId(String(event.active.id).replace(/^folder:/, ""))
      }
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {folders.map((folder) => (
          <DraggableFolderCard
            key={folder.id}
            folder={folder}
            dragging={activeId === folder.id}
          />
        ))}
      </div>
      <DragOverlay>
        {activeFolder ? (
          <div className="flex items-center gap-3 border border-border bg-card p-4 shadow-lg">
            <Folder className="size-5 text-muted-foreground" strokeWidth={1.5} />
            <p className="truncate text-sm font-medium">{activeFolder.name}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function folderMeta(folder: FolderGridItem): string {
  const parts: string[] = [];
  if (folder.subfolderCount > 0) {
    parts.push(
      `${folder.subfolderCount} folder${folder.subfolderCount === 1 ? "" : "s"}`
    );
  }
  parts.push(`${folder.photoCount} photo${folder.photoCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

function CardInner({ folder }: { folder: FolderGridItem }) {
  return (
    <>
      <Folder
        className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        strokeWidth={1.5}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{folder.name}</p>
        <p className="text-xs text-muted-foreground">{folderMeta(folder)}</p>
      </div>
    </>
  );
}

function StaticFolderCard({ folder }: { folder: FolderGridItem }) {
  return (
    <Link
      href={`/photos/${folder.id}`}
      className="group flex items-center gap-3 border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40"
    >
      <CardInner folder={folder} />
    </Link>
  );
}

function DraggableFolderCard({
  folder,
  dragging,
}: {
  folder: FolderGridItem;
  dragging: boolean;
}) {
  // Each card is both a drag handle and a drop target.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder:${folder.id}`,
  });
  const { setNodeRef: setDragRef, attributes, listeners } = useDraggable({
    id: `folder:${folder.id}`,
  });

  return (
    <div ref={setDropRef}>
      <Link
        ref={setDragRef as React.Ref<HTMLAnchorElement>}
        href={`/photos/${folder.id}`}
        draggable={false}
        {...attributes}
        {...listeners}
        className={cn(
          "group flex items-center gap-3 border p-4 transition-colors",
          // Match the sidebar's unmistakable gold drop target.
          isOver
            ? "border-[#C2912D] bg-[#C2912D] text-white ring-2 ring-[#C2912D]"
            : "border-border bg-card hover:border-muted-foreground/40",
          dragging && "opacity-30"
        )}
      >
        <CardInner folder={folder} />
      </Link>
    </div>
  );
}
