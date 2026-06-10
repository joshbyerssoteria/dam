import type { Metadata } from "next";
import Link from "next/link";
import { Folder } from "lucide-react";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { KitCard } from "@/components/kit-card";
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
          <>
            {folderCounts.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {folderCounts.map((folder) => (
                  <Link
                    key={folder.id}
                    href={`/kits/f/${folder.id}`}
                    className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40"
                  >
                    <Folder
                      className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                      strokeWidth={1.5}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{folder.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {folder.subCount > 0
                          ? `${folder.subCount} folder${folder.subCount === 1 ? "" : "s"} · `
                          : ""}
                        {folder.kitCount} kit{folder.kitCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}

            {(kits ?? []).length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(kits ?? []).map((kit) => (
                  <KitCard key={kit.id} kit={kit} canShare={canEdit} />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
