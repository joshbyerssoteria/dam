import type { Metadata } from "next";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { KitsDndGrid } from "@/components/kits-dnd-grid";
import { NewKitDialog } from "@/components/new-kit-dialog";
import { NewKitFolderDialog } from "@/components/new-kit-folder-dialog";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Kits" };

export default async function KitsPage() {
  const session = await getSessionProfile();
  const db = await createClient();

  const [{ data: kitFolders }, { data: kits }, { data: allFolders }] =
    await Promise.all([
      db
        .from("kit_folders")
        .select("id, name")
        .is("parent_id", null)
        .order("sort_order")
        .order("name"),
      db
        .from("kits")
        .select("id, slug, name, description, cover_image_id")
        .is("kit_folder_id", null)
        .order("sort_order")
        .order("name"),
      db.from("kit_folders").select("id, name").order("name"),
    ]);

  const folderList = kitFolders ?? [];
  const folderCounts = await Promise.all(
    folderList.map(async (folder) => {
      const [{ count: kitCount }, { count: subCount }] = await Promise.all([
        db
          .from("kits")
          .select("id", { count: "exact", head: true })
          .eq("kit_folder_id", folder.id),
        db
          .from("kit_folders")
          .select("id", { count: "exact", head: true })
          .eq("parent_id", folder.id),
      ]);
      return { ...folder, kitCount: kitCount ?? 0, subCount: subCount ?? 0 };
    })
  );

  const canEdit = session !== null && session.profile.role !== "viewer";
  const empty = folderCounts.length === 0 && (kits ?? []).length === 0;

  return (
    <div>
      <PageHeader
        title="Kits"
        description="Brand assets — logos, color palettes, fonts, and templates."
      >
        {canEdit ? (
          <>
            <NewKitFolderDialog parentId={null} />
            <NewKitDialog folders={allFolders ?? []} defaultFolderId={null} />
          </>
        ) : null}
      </PageHeader>

      <div className="space-y-8 p-8">
        {empty ? (
          <div className="py-24 text-center">
            <p className="text-sm text-muted-foreground">
              No kits yet.{" "}
              {canEdit ? "Create the first kit to organize brand assets." : ""}
            </p>
          </div>
        ) : (
          <KitsDndGrid
            folders={folderCounts.map((folder) => ({
              id: folder.id,
              name: folder.name,
              meta: `${
                folder.subCount > 0
                  ? `${folder.subCount} folder${folder.subCount === 1 ? "" : "s"} · `
                  : ""
              }${folder.kitCount} kit${folder.kitCount === 1 ? "" : "s"}`,
            }))}
            kits={kits ?? []}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}
