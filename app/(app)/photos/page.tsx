import type { Metadata } from "next";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { PhotoFolderGrid } from "@/components/photo-folder-grid";
import { NewFolderDialog } from "@/components/new-folder-dialog";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Photos" };

export default async function PhotosPage() {
  const session = await getSessionProfile();
  const db = await createClient();

  const { data: folders } = await db
    .from("folders")
    .select("id, name, sort_order, created_at")
    .is("parent_id", null)
    .order("sort_order")
    .order("name");

  const folderList = folders ?? [];
  const counts = await Promise.all(
    folderList.map(async (folder) => {
      const [{ count: photoCount }, { count: subfolderCount }] =
        await Promise.all([
          db
            .from("photos")
            .select("id", { count: "exact", head: true })
            .eq("folder_id", folder.id),
          db
            .from("folders")
            .select("id", { count: "exact", head: true })
            .eq("parent_id", folder.id),
        ]);
      return {
        ...folder,
        photoCount: photoCount ?? 0,
        subfolderCount: subfolderCount ?? 0,
      };
    })
  );

  const canEdit = session !== null && session.profile.role !== "viewer";

  return (
    <div>
      <PageHeader
        title="Photos"
        description="The event archive — folders, galleries, and AI-tagged photos."
      >
        {canEdit ? <NewFolderDialog parentId={null} /> : null}
      </PageHeader>

      <div className="p-8">
        {counts.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm text-muted-foreground">
              No folders yet.{" "}
              {canEdit
                ? "Create the first folder to start organizing photos."
                : ""}
            </p>
          </div>
        ) : (
          <PhotoFolderGrid folders={counts} canEdit={canEdit} />
        )}
      </div>
    </div>
  );
}
