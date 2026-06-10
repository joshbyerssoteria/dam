import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import type { FolderRow } from "@/lib/database.types";
import { FolderCard } from "@/components/folder-card";
import { NewFolderDialog } from "@/components/new-folder-dialog";
import { FolderActions } from "@/components/folder-actions";
import { PageHeader } from "@/components/page-header";
import { PhotoGrid, type PhotoGridItem } from "@/components/photo-grid";
import { ShareDialog } from "@/components/share-dialog";
import { UploadDropzone } from "@/components/upload-dropzone";

export const metadata: Metadata = { title: "Photos" };

async function buildBreadcrumbs(
  db: Awaited<ReturnType<typeof createClient>>,
  folder: FolderRow
): Promise<Array<{ id: string; name: string }>> {
  const crumbs: Array<{ id: string; name: string }> = [];
  let parentId = folder.parent_id;
  // Walk up the tree (bounded to avoid cycles).
  for (let depth = 0; parentId && depth < 20; depth += 1) {
    const { data: parent } = await db
      .from("folders")
      .select("id, name, parent_id")
      .eq("id", parentId)
      .single();
    if (!parent) break;
    crumbs.unshift({ id: parent.id, name: parent.name });
    parentId = parent.parent_id;
  }
  return crumbs;
}

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  const session = await getSessionProfile();
  const db = await createClient();

  const { data: folder } = await db
    .from("folders")
    .select("*")
    .eq("id", folderId)
    .single();
  if (!folder) notFound();

  const [crumbs, { data: subfolders }, { data: photos }] = await Promise.all([
    buildBreadcrumbs(db, folder),
    db
      .from("folders")
      .select("id, name")
      .eq("parent_id", folder.id)
      .order("sort_order")
      .order("name"),
    db
      .from("photos")
      .select("*, files(*)")
      .eq("folder_id", folder.id)
      .order("created_at", { ascending: false }),
  ]);

  const subfolderList = subfolders ?? [];
  const subfolderCounts = await Promise.all(
    subfolderList.map(async (subfolder) => {
      const [{ count: photoCount }, { count: subCount }] = await Promise.all([
        db
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("folder_id", subfolder.id),
        db
          .from("folders")
          .select("id", { count: "exact", head: true })
          .eq("parent_id", subfolder.id),
      ]);
      return {
        ...subfolder,
        photoCount: photoCount ?? 0,
        subfolderCount: subCount ?? 0,
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

        <PhotoGrid photos={gridItems} allowDelete={canEdit} />
      </div>
    </div>
  );
}
