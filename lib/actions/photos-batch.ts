"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { EVENT_TYPES } from "@/lib/tagging";

const moveSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1).max(500),
  folderId: z.string().uuid(),
});

/** Batch move: re-home the selected photos into another folder. */
export async function batchMovePhotos(input: {
  photoIds: string[];
  folderId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid selection" };

  const db = await createClient();
  const { data: folder } = await db
    .from("folders")
    .select("id")
    .eq("id", parsed.data.folderId)
    .single();
  if (!folder) return { ok: false, error: "Destination folder not found" };

  const { error } = await db
    .from("photos")
    .update({ folder_id: parsed.data.folderId })
    .in("id", parsed.data.photoIds);
  if (error) return { ok: false, error: "Failed to move photos" };

  revalidatePath("/photos");
  return { ok: true };
}

const batchSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1).max(500),
  addTags: z.array(z.string().trim().min(1).max(60)).max(30),
  eventType: z.enum(EVENT_TYPES).nullable(),
  photographerName: z.string().trim().max(120).nullable(),
});

/**
 * Batch edit: append tags and/or set event type and photographer on the
 * selected photos. Null fields are left unchanged.
 */
export async function batchUpdatePhotos(input: {
  photoIds: string[];
  addTags: string[];
  eventType: string | null;
  photographerName: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid edit" };
  }
  const { photoIds, addTags, eventType, photographerName } = parsed.data;
  const newTags = addTags.map((tag) => tag.toLowerCase());

  const db = await createClient();

  if (newTags.length > 0) {
    // Tags append per-photo (deduplicated against existing).
    const { data: rows } = await db
      .from("photos")
      .select("id, ai_tags")
      .in("id", photoIds);
    for (const row of rows ?? []) {
      const merged = [...new Set([...(row.ai_tags ?? []), ...newTags])];
      const { error } = await db
        .from("photos")
        .update({ ai_tags: merged })
        .eq("id", row.id);
      if (error) return { ok: false, error: "Failed to update tags" };
    }
  }

  const flatUpdates: { event_type?: string; photographer_name?: string } = {};
  if (eventType) flatUpdates.event_type = eventType;
  if (photographerName) flatUpdates.photographer_name = photographerName;
  if (Object.keys(flatUpdates).length > 0) {
    const { error } = await db
      .from("photos")
      .update(flatUpdates)
      .in("id", photoIds);
    if (error) return { ok: false, error: "Failed to update photos" };
  }

  revalidatePath("/photos");
  return { ok: true };
}
