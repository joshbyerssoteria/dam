import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { NotConfigured } from "@/components/not-configured";
import {
  collectFolderSubtreeIds,
  isShareUnlocked,
  resolveShare,
  shareUnlockCookieName,
} from "@/lib/share-access";
import { PhotoGrid, type PhotoGridItem } from "@/components/photo-grid";
import { SharePasswordForm } from "@/components/share-password-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Shared folder" };

export default async function SharedFolderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = tryCreateAdminClient();
  if (!admin) return <NotConfigured />;
  const resolved = await resolveShare(admin, token);
  if (!resolved || resolved.targetType !== "folder") notFound();

  const cookieStore = await cookies();
  if (
    !isShareUnlocked(
      resolved.share,
      cookieStore.get(shareUnlockCookieName(token))?.value
    )
  ) {
    return <SharePasswordForm token={token} />;
  }

  const folderIds = await collectFolderSubtreeIds(admin, resolved.folder.id);
  const { data: photos } = await admin
    .from("photos")
    .select("*, files(*)")
    .in("folder_id", folderIds)
    .order("created_at", { ascending: false });

  const items: PhotoGridItem[] = (photos ?? []).flatMap((photo) => {
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
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Soteria Assets — shared folder
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {resolved.folder.name}
          </h1>
          {resolved.folder.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {resolved.folder.description}
            </p>
          ) : null}
        </div>
        {items.length > 0 ? (
          <Button asChild>
            <a href={`/api/share/${token}/zip`}>
              <Download className="size-4" />
              Download all
            </a>
          </Button>
        ) : null}
      </header>

      <PhotoGrid photos={items} srcPrefix={`/api/share/${token}/file`} />
    </div>
  );
}
