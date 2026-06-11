"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullable(),
});

export async function createFolder(input: {
  name: string;
  parentId: string | null;
}): Promise<{ ok: true; folderId: string } | { ok: false; error: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  const parsed = createFolderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid folder name" };

  const db = await createClient();
  const { data: space } = await db.from("spaces").select("id").limit(1).single();
  if (!space) return { ok: false, error: "No space configured" };

  const { data: folder, error } = await db
    .from("folders")
    .insert({
      space_id: space.id,
      parent_id: parsed.data.parentId,
      name: parsed.data.name,
      slug: slugify(parsed.data.name) || "folder",
    })
    .select("id")
    .single();
  if (error || !folder) return { ok: false, error: "Failed to create folder" };

  revalidatePath("/photos");
  return { ok: true, folderId: folder.id };
}

export async function renameFolder(
  folderId: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name required" };

  const db = await createClient();
  const { error } = await db
    .from("folders")
    .update({ name: trimmed, slug: slugify(trimmed) || "folder" })
    .eq("id", folderId);
  if (error) return { ok: false, error: "Failed to rename" };

  revalidatePath("/photos");
  return { ok: true };
}

/**
 * Move a folder under a new parent (or to the root with null). Guards
 * against moving a folder into itself or one of its own descendants, which
 * would orphan a subtree.
 */
export async function moveFolder(
  folderId: string,
  newParentId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }
  if (folderId === newParentId) {
    return { ok: false, error: "A folder can't contain itself" };
  }

  const db = await createClient();

  if (newParentId) {
    // Walk up from the target; if we reach folderId, the move is a cycle.
    const { data: allFolders } = await db
      .from("folders")
      .select("id, parent_id");
    const parentOf = new Map(
      (allFolders ?? []).map((f) => [f.id, f.parent_id])
    );
    let cursor: string | null = newParentId;
    for (let depth = 0; cursor && depth < 100; depth += 1) {
      if (cursor === folderId) {
        return { ok: false, error: "Can't move a folder into its own subfolder" };
      }
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  const { error } = await db
    .from("folders")
    .update({ parent_id: newParentId })
    .eq("id", folderId);
  if (error) return { ok: false, error: "Failed to move folder" };

  revalidatePath("/photos");
  return { ok: true };
}

export async function deleteFolder(
  folderId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") {
    return { ok: false, error: "Only admins can delete folders" };
  }

  const db = await createClient();
  const { error } = await db.from("folders").delete().eq("id", folderId);
  if (error) return { ok: false, error: "Failed to delete folder" };

  revalidatePath("/photos");
  return { ok: true };
}

export async function deletePhoto(
  photoId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  // RLS enforces admin-or-own-upload; a denied delete affects 0 rows.
  const db = await createClient();
  const { error, count } = await db
    .from("photos")
    .delete({ count: "exact" })
    .eq("id", photoId);
  if (error) return { ok: false, error: "Failed to delete photo" };
  if (count === 0) return { ok: false, error: "You can only delete your own uploads" };

  revalidatePath("/photos");
  return { ok: true };
}
