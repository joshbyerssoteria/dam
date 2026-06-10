import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { KitFolderActions } from "@/components/kit-folder-actions";
import { KitsDndGrid } from "@/components/kits-dnd-grid";
import { NewKitDialog } from "@/components/new-kit-dialog";
import { NewKitFolderDialog } from "@/components/new-kit-folder-dialog";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Kits" };

export default async function KitFolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const db = await createClient();

  // One round trip: session, the whole (small) kit-folder tree, this
  // folder's kits. Breadcrumbs and subfolders compute in memory.
  const [session, { data: allFolders }, { data: kits }] = await Promise.all([
    getSessionProfile(),
    db
      .from("kit_folders")
      .select("id, name, parent_id, description, sort_order")
      .order("name"),
    db
      .from("kits")
      .select("id, slug, name, description, cover_image_id")
      .eq("kit_folder_id", folderId)
      .order("sort_order")
      .order("name"),
  ]);

  const folderList = allFolders ?? [];
  const folderById = new Map(folderList.map((f) => [f.id, f]));
  const folder = folderById.get(folderId);
  if (!folder) notFound();

  const crumbs: Array<{ id: string; name: string }> = [];
  let parentId = folder.parent_id;
  for (let depth = 0; parentId && depth < 20; depth += 1) {
    const parent = folderById.get(parentId);
    if (!parent) break;
    crumbs.unshift({ id: parent.id, name: parent.name });
    parentId = parent.parent_id;
  }

  const subfolders = folderList
    .filter((f) => f.parent_id === folder.id)
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );

  const role = session?.profile.role ?? "viewer";
  const canEdit = role !== "viewer";

  return (
    <div>
      <PageHeader title={folder.name} description={folder.description ?? undefined}>
        {canEdit ? (
          <>
            <NewKitFolderDialog parentId={folder.id} />
            <NewKitDialog
              folders={folderList.map(({ id, name }) => ({ id, name }))}
              defaultFolderId={folder.id}
            />
            <KitFolderActions
              folderId={folder.id}
              folderName={folder.name}
              parentId={folder.parent_id}
              isAdmin={role === "admin"}
            />
          </>
        ) : null}
      </PageHeader>

      <div className="space-y-8 p-8">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <Link href="/kits" className="hover:text-foreground">
            Kits
          </Link>
          {crumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5" />
              <Link href={`/kits/f/${crumb.id}`} className="hover:text-foreground">
                {crumb.name}
              </Link>
            </span>
          ))}
          <ChevronRight className="size-3.5" />
          <span className="text-foreground">{folder.name}</span>
        </nav>

        {(kits ?? []).length === 0 && (subfolders ?? []).length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nothing in this folder yet.
          </p>
        ) : (
          <KitsDndGrid
            folders={(subfolders ?? []).map((subfolder) => ({
              id: subfolder.id,
              name: subfolder.name,
            }))}
            kits={kits ?? []}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}
