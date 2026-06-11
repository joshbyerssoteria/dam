import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { PageHeader } from "@/components/page-header";
import { ProjectGrid } from "@/components/project-grid";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const db = await createClient();

  const { data: projects } = await db
    .from("projects")
    .select("id, name, parent_id, sort_order");
  const projectList = projects ?? [];
  const roots = projectList
    .filter((project) => project.parent_id === null)
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );

  // Photo counts: one parallel count per root project; subproject counts
  // from the in-memory list.
  const cards = await Promise.all(
    roots.map(async (project) => {
      const { count } = await db
        .from("project_photos")
        .select("photo_id", { count: "exact", head: true })
        .eq("project_id", project.id);
      return {
        id: project.id,
        name: project.name,
        photoCount: count ?? 0,
        subprojectCount: projectList.filter(
          (p) => p.parent_id === project.id
        ).length,
      };
    })
  );

  const canEdit = session.profile.role !== "viewer";

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Collect photos for a piece of work. Photos are referenced, never moved or duplicated — deleting a project never deletes photos."
      >
        {canEdit ? <NewProjectDialog parentId={null} /> : null}
      </PageHeader>
      <div className="p-8">
        {cards.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted-foreground">
            No projects yet — create one here, or select photos anywhere in
            the library and choose “Add to project”.
          </p>
        ) : (
          <ProjectGrid projects={cards} canEdit={canEdit} />
        )}
      </div>
    </div>
  );
}
