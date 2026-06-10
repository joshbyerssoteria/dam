import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { FolderCard } from "@/components/folder-card";
import { NewFolderDialog } from "@/components/new-folder-dialog";
import { FolderActions } from "@/components/folder-actions";
import { PageHeader } from "@/components/page-header";
import { PhotoGrid, type PhotoGridItem } from "@/components/photo-grid";
import { ShareDialog } from "@/components/share-dialog";
import { UploadDropzone } from "@/components/upload-dropzone";

export const metadata: Metadata = { title: "Photos" };

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const db = await createClient();

  // One round trip: session, the full folder tree (small — breadcrumbs and
  // subfolder counts compute in memory), and this folder's photos.
  const [session, { data: allFolders }, { data: photos }, { data: favorites }] =
    await Promise.all([
      getSessionProfile(),
      db.from("folders").select("id, name, parent_id, description, sort_order"),
      db
        .from("photos")
        .select("*, files(*)")
        .eq("folder_id", folderId)
        .order("created_at", { ascending: false }),
      // RLS scopes favorites to the signed-in user.
      db.from("photo_favorites").select("photo_id"),
    ]);
  const favoriteIds = (favorites ?? []).map((row) => row.photo_id);

  const folderList = allFolders ?? [];
  const folderById = new Map(folderList.map((f) => [f.id, f]));
  const folder = folderById.get(folderId);
  if (!folder) notFound();

  // Breadcrumbs: walk up in memory (bounded against cycles).
  const crumbs: Array<{ id: string; name: string }> = [];
  let parentId = folder.parent_id;
  for (let depth = 0; parentId && depth < 20; depth += 1) {
    const parent = folderById.get(parentId);
    if (!parent) break;
    crumbs.unshift({ id: parent.id, name: parent.name });
    parentId = parent.parent_id;
  }

  const subfolderList = folderList
    .filter((f) => f.parent_id === folder.id)
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );

  // Photo counts: one parallel count per subfolder; subfolder counts from
  // the in-memory tree.
  const subfolderCounts = await Promise.all(
    subfolderList.map(async (subfolder) => {
      const { count: photoCount } = await db
        .from("photos")
        .select("id", { count: "exact", head: true })
        .eq("folder_id", subfolder.id);
      return {
        ...subfolder,
        photoCount: photoCount ?? 0,
        subfolderCount: folderList.filter((f) => f.parent_id === subfolder.id)
          .length,
      };
    })
  );

  const role = session?.profile.role ?? "viewer";
  const canEdit = role !== "viewer";
  const isAdmin = role === "admin";

  const gridItems: PhotoGridItem[] = (photos ?? []).flatMap((photo) => {
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
        canDelete:
          isAdmin || (canEdit && photo.uploaded_by === session?.userId),
      },
    ];
  });

  return (
    <div>
      <PageHeader
        title={folder.name}
        description={folder.description ?? undefined}
      >
        {canEdit ? (
          <>
            <NewFolderDialog parentId={folder.id} />
            <ShareDialog
              targetType="folder"
              targetId={folder.id}
              targetName={folder.name}
            />
            <FolderActions
              folderId={folder.id}
              folderName={folder.name}
              parentId={folder.parent_id}
              isAdmin={isAdmin}
            />
          </>
        ) : null}
      </PageHeader>

      <div className="space-y-8 p-8">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <Link href="/photos" className="hover:text-foreground">
            Photos
          </Link>
          {crumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5" />
              <Link href={`/photos/${crumb.id}`} className="hover:text-foreground">
                {crumb.name}
              </Link>
            </span>
          ))}
          <ChevronRight className="size-3.5" />
          <span className="text-foreground">{folder.name}</span>
        </nav>

        {canEdit ? (
          <UploadDropzone intent={{ intent: "photo", folderId: folder.id }} />
        ) : null}

        {subfolderCounts.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {subfolderCounts.map((subfolder) => (
              <FolderCard
                key={subfolder.id}
                id={subfolder.id}
                name={subfolder.name}
                photoCount={subfolder.photoCount}
                subfolderCount={subfolder.subfolderCount}
              />
            ))}
          </div>
        ) : null}

        <PhotoGrid
          photos={gridItems}
          allowDelete={canEdit}
          allowFavorites
          allowBatch
          canEditMeta={canEdit}
          favoriteIds={favoriteIds}
          folders={folderList.map(({ id, name, parent_id }) => ({
            id,
            name,
            parent_id,
          }))}
        />
      </div>
    </div>
  );
}
