"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionProfile } from "@/lib/supabase/server";

export async function setFavorite(
  photoId: string,
  favorite: boolean
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  if (favorite) {
    const { error } = await db
      .from("photo_favorites")
      .upsert(
        { photo_id: photoId, user_id: session.userId },
        { onConflict: "photo_id,user_id", ignoreDuplicates: true }
      );
    if (error) return { ok: false, error: "Failed to favorite" };
  } else {
    const { error } = await db
      .from("photo_favorites")
      .delete()
      .eq("photo_id", photoId)
      .eq("user_id", session.userId);
    if (error) return { ok: false, error: "Failed to unfavorite" };
  }

  revalidatePath("/photos/favorites");
  return { ok: true };
}

/** Batch: add all the given photos to the user's favorites. */
export async function favoriteMany(
  photoIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Not signed in" };
  if (photoIds.length === 0 || photoIds.length > 500) {
    return { ok: false, error: "Invalid selection" };
  }

  const db = await createClient();
  const { error } = await db.from("photo_favorites").upsert(
    photoIds.map((photoId) => ({
      photo_id: photoId,
      user_id: session.userId,
    })),
    { onConflict: "photo_id,user_id", ignoreDuplicates: true }
  );
  if (error) return { ok: false, error: "Failed to favorite" };

  revalidatePath("/photos/favorites");
  return { ok: true };
}
