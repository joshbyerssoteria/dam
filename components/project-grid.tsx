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
import { FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { moveProject } from "@/lib/actions/projects";
import { cn } from "@/lib/utils";

export interface ProjectGridItem {
  id: string;
  name: string;
  photoCount: number;
  subprojectCount: number;
}

/**
 * Grid of project cards that can be dragged into one another to re-nest,
 * mirroring PhotoFolderGrid. Editors get drag-and-drop; viewers get plain
 * links.
 */
export function ProjectGrid({
  projects,
  canEdit,
}: {
  projects: ProjectGridItem[];
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
    const projectId = String(active.id).replace(/^project:/, "");
    const targetId = String(over.id).replace(/^project:/, "");
    if (projectId === targetId) return;

    const result = await moveProject(projectId, targetId);
    if (result.ok) {
      if (!result.unchanged) {
        const target = projects.find((p) => p.id === targetId);
        toast.success(`Moved into ${target?.name ?? "project"}`);
        router.refresh();
      }
    } else {
      toast.error(result.error ?? "Failed to move project");
    }
  }

  if (!canEdit) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {projects.map((project) => (
          <StaticProjectCard key={project.id} project={project} />
        ))}
      </div>
    );
  }

  const activeProject = activeId
    ? projects.find((p) => p.id === activeId)
    : null;

  return (
    <DndContext
      id="project-grid-dnd"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(event) =>
        setActiveId(String(event.active.id).replace(/^project:/, ""))
      }
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {projects.map((project) => (
          <DraggableProjectCard
            key={project.id}
            project={project}
            dragging={activeId === project.id}
          />
        ))}
      </div>
      <DragOverlay>
        {activeProject ? (
          <div className="flex items-center gap-3 border border-border bg-card p-4 shadow-lg">
            <FolderKanban
              className="size-5 text-muted-foreground"
              strokeWidth={1.5}
            />
            <p className="truncate text-sm font-medium">{activeProject.name}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function projectMeta(project: ProjectGridItem): string {
  const parts: string[] = [];
  if (project.subprojectCount > 0) {
    parts.push(
      `${project.subprojectCount} project${project.subprojectCount === 1 ? "" : "s"}`
    );
  }
  parts.push(`${project.photoCount} photo${project.photoCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

function CardInner({ project }: { project: ProjectGridItem }) {
  return (
    <>
      <FolderKanban
        className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        strokeWidth={1.5}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{project.name}</p>
        <p className="text-xs text-muted-foreground">{projectMeta(project)}</p>
      </div>
    </>
  );
}

function StaticProjectCard({ project }: { project: ProjectGridItem }) {
  return (
    <Link
      href={`/photos/projects/${project.id}`}
      className="group flex items-center gap-3 border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40"
    >
      <CardInner project={project} />
    </Link>
  );
}

function DraggableProjectCard({
  project,
  dragging,
}: {
  project: ProjectGridItem;
  dragging: boolean;
}) {
  // Each card is both a drag handle and a drop target.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `project:${project.id}`,
  });
  const { setNodeRef: setDragRef, attributes, listeners } = useDraggable({
    id: `project:${project.id}`,
  });

  return (
    <div ref={setDropRef}>
      <Link
        ref={setDragRef as React.Ref<HTMLAnchorElement>}
        href={`/photos/projects/${project.id}`}
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
        <CardInner project={project} />
      </Link>
    </div>
  );
}
