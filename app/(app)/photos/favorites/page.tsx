import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PhotoGrid, type PhotoGridItem } from "@/components/photo-grid";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  const db = await createClient();

  // RLS scopes favorites to the signed-in user.
  const { data: favorites } = await db
    .from("photo_favorites")
    .select("photo_id, created_at")
    .order("created_at", { ascending: false });
  const favoriteIds = (favorites ?? []).map((row) => row.photo_id);

  const { data: photos } = favoriteIds.length
    ? await db.from("photos").select("*, files(*)").in("id", favoriteIds)
    : { data: [] };

  const role = session.profile.role;
  const isAdmin = role === "admin";
  const canEdit = role !== "viewer";

  const orderIndex = new Map(favoriteIds.map((id, index) => [id, index]));
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
          canDelete: isAdmin || (canEdit && photo.uploaded_by === session.userId),
        },
      ];
    })
    .sort(
      (a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0)
    );

  return (
    <div>
      <PageHeader
        title="Favorites"
        description="Your hand-picked photos, from anywhere in the library."
      />
      <div className="p-8">
        {gridItems.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted-foreground">
            Nothing here yet — hover any photo and click the heart to add it.
          </p>
        ) : (
          <PhotoGrid
            photos={gridItems}
            allowDelete={canEdit}
            allowFavorites
            allowBatch
            canEditMeta={canEdit}
            favoriteIds={favoriteIds}
          />
        )}
      </div>
    </div>
  );
}
