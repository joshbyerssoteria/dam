import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { PageHeader } from "@/components/page-header";
import { PhotoGrid, type PhotoGridItem } from "@/components/photo-grid";
import { ProjectActions } from "@/components/project-actions";
import { ProjectGrid } from "@/components/project-grid";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const db = await createClient();

  // One round trip: session, the full project tree (small — breadcrumbs and
  // counts compute in memory), this project's photo links, and the folder
  // list (for the batch move dialog).
  const [session, { data: allProjects }, { data: links }, { data: folders }, { data: favorites }] =
    await Promise.all([
      getSessionProfile(),
      db.from("projects").select("id, name, parent_id, description, sort_order"),
      db
        .from("project_photos")
        .select("photo_id, added_at")
        .eq("project_id", projectId)
        .order("added_at", { ascending: false }),
      db.from("folders").select("id, name, parent_id"),
      // RLS scopes favorites to the signed-in user.
      db.from("photo_favorites").select("photo_id"),
    ]);
  const favoriteIds = (favorites ?? []).map((row) => row.photo_id);

  const projectList = allProjects ?? [];
  const projectById = new Map(projectList.map((p) => [p.id, p]));
  const project = projectById.get(projectId);
  if (!project) notFound();

  const linkedIds = (links ?? []).map((row) => row.photo_id);
  const { data: photos } = linkedIds.length
    ? await db.from("photos").select("*, files(*)").in("id", linkedIds)
    : { data: [] };

  // Breadcrumbs: walk up in memory (bounded against cycles).
  const crumbs: Array<{ id: string; name: string }> = [];
  let parentId = project.parent_id;
  for (let depth = 0; parentId && depth < 20; depth += 1) {
    const parent = projectById.get(parentId);
    if (!parent) break;
    crumbs.unshift({ id: parent.id, name: parent.name });
    parentId = parent.parent_id;
  }

  const subprojectList = projectList
    .filter((p) => p.parent_id === project.id)
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );
  const subprojectCards = await Promise.all(
    subprojectList.map(async (subproject) => {
      const { count } = await db
        .from("project_photos")
        .select("photo_id", { count: "exact", head: true })
        .eq("project_id", subproject.id);
      return {
        id: subproject.id,
        name: subproject.name,
        photoCount: count ?? 0,
        subprojectCount: projectList.filter(
          (p) => p.parent_id === subproject.id
        ).length,
      };
    })
  );

  const role = session?.profile.role ?? "viewer";
  const canEdit = role !== "viewer";

  const orderIndex = new Map(linkedIds.map((id, index) => [id, index]));
  const gridItems: PhotoGridItem[] = (photos ?? [])
    .flatMap((photo) => {
      const file = photo.files as {
        id: string;
        original_filename: string;
        file_size: number;
        width: number | null;
        height: number | null;
      } | null;
      if (!file) return [];
      return [
        {
          id: photo.id,
          fileId: file.id,
          originalFilename: file.original_filename,
          fileSize: file.file_size,
          width: file.width,
          height: file.height,
          aiTags: photo.ai_tags,
          aiCaption: photo.ai_caption,
          aiScene: photo.ai_scene,
          eventType: photo.event_type,
          takenAt: photo.taken_at,
          photographerName: photo.photographer_name,
          createdAt: photo.created_at,
          canDelete: false,
        },
      ];
    })
    .sort(
      (a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0)
    );

  return (
    <div>
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
      >
        {canEdit ? (
          <>
            <NewProjectDialog parentId={project.id} />
            <ProjectActions
              projectId={project.id}
              projectName={project.name}
              parentId={project.parent_id}
            />
          </>
        ) : null}
      </PageHeader>

      <div className="space-y-8 p-8">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <Link href="/photos/projects" className="hover:text-foreground">
            Projects
          </Link>
          {crumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5" />
              <Link
                href={`/photos/projects/${crumb.id}`}
                className="hover:text-foreground"
              >
                {crumb.name}
              </Link>
            </span>
          ))}
          <ChevronRight className="size-3.5" />
          <span className="text-foreground">{project.name}</span>
        </nav>

        {subprojectCards.length > 0 ? (
          <ProjectGrid projects={subprojectCards} canEdit={canEdit} />
        ) : null}

        {gridItems.length === 0 && subprojectCards.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted-foreground">
            Nothing here yet — select photos anywhere in the library and
            choose “Add to project”. Photos stay in their folders; this
            project only references them.
          </p>
        ) : (
          <PhotoGrid
            photos={gridItems}
            allowFavorites
            allowBatch
            canEditMeta={canEdit}
            favoriteIds={favoriteIds}
            folders={folders ?? []}
            projects={projectList.map(({ id, name, parent_id }) => ({
              id,
              name,
              parent_id,
            }))}
            projectId={project.id}
          />
        )}
      </div>
    </div>
  );
}
