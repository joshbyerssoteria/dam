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
  const session = await getSessionProfile();
  const db = await createClient();

  const { data: folder } = await db
    .from("kit_folders")
    .select("*")
    .eq("id", folderId)
    .single();
  if (!folder) notFound();

  // Breadcrumbs up the kit-folder tree (bounded against cycles).
  const crumbs: Array<{ id: string; name: string }> = [];
  let parentId = folder.parent_id;
  for (let depth = 0; parentId && depth < 20; depth += 1) {
    const { data: parent } = await db
      .from("kit_folders")
      .select("id, name, parent_id")
      .eq("id", parentId)
      .single();
    if (!parent) break;
    crumbs.unshift({ id: parent.id, name: parent.name });
    parentId = parent.parent_id;
  }

  const [{ data: subfolders }, { data: kits }, { data: allFolders }] =
    await Promise.all([
      db
        .from("kit_folders")
        .select("id, name")
        .eq("parent_id", folder.id)
        .order("sort_order")
        .order("name"),
      db
        .from("kits")
        .select("id, slug, name, description, cover_image_id")
        .eq("kit_folder_id", folder.id)
        .order("sort_order")
        .order("name"),
      db.from("kit_folders").select("id, name").order("name"),
    ]);

  const role = session?.profile.role ?? "viewer";
  const canEdit = role !== "viewer";

  return (
    <div>
      <PageHeader title={folder.name} description={folder.description ?? undefined}>
        {canEdit ? (
          <>
            <NewKitFolderDialog parentId={folder.id} />
            <NewKitDialog folders={allFolders ?? []} defaultFolderId={folder.id} />
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
