"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullable(),
});

export async function createKitFolder(input: {
  name: string;
  parentId: string | null;
}): Promise<{ ok: true; folderId: string } | { ok: false; error: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid folder name" };

  const db = await createClient();
  const { data: space } = await db.from("spaces").select("id").limit(1).single();
  if (!space) return { ok: false, error: "No space configured" };

  const { data: folder, error } = await db
    .from("kit_folders")
    .insert({
      space_id: space.id,
      parent_id: parsed.data.parentId,
      name: parsed.data.name,
      slug: slugify(parsed.data.name) || "folder",
    })
    .select("id")
    .single();
  if (error || !folder) return { ok: false, error: "Failed to create folder" };

  revalidatePath("/kits");
  return { ok: true, folderId: folder.id };
}

export async function renameKitFolder(
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
    .from("kit_folders")
    .update({ name: trimmed, slug: slugify(trimmed) || "folder" })
    .eq("id", folderId);
  if (error) return { ok: false, error: "Failed to rename" };

  revalidatePath("/kits");
  return { ok: true };
}

export async function deleteKitFolder(
  folderId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") {
    return { ok: false, error: "Only admins can delete kit folders" };
  }

  // Kits inside are detached (kit_folder_id → null), not deleted.
  const db = await createClient();
  const { error } = await db.from("kit_folders").delete().eq("id", folderId);
  if (error) return { ok: false, error: "Failed to delete folder" };

  revalidatePath("/kits");
  return { ok: true };
}

export async function moveKitToFolder(
  kitId: string,
  kitFolderId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  const db = await createClient();
  const { error } = await db
    .from("kits")
    .update({ kit_folder_id: kitFolderId })
    .eq("id", kitId);
  if (error) return { ok: false, error: "Failed to move kit" };

  revalidatePath("/kits");
  return { ok: true };
}
