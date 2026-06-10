"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { generateShareToken } from "@/lib/tokens";

const createUploadTokenSchema = z.object({
  targetFolderId: z.string().uuid(),
  expiresAt: z.string().datetime().nullable(),
  maxFiles: z.number().int().positive().max(5000).nullable(),
  photographerName: z.string().trim().max(120),
  photographerEmail: z.string().trim().email().or(z.literal("")),
  instructions: z.string().trim().max(2000),
});

export async function createUploadToken(input: {
  targetFolderId: string;
  expiresAt: string | null;
  maxFiles: number | null;
  photographerName: string;
  photographerEmail: string;
  instructions: string;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") {
    return { ok: false, error: "Only admins can create upload links" };
  }

  const parsed = createUploadTokenSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  const token = generateShareToken();
  const db = await createClient();
  const { error } = await db.from("upload_tokens").insert({
    token,
    target_folder_id: parsed.data.targetFolderId,
    expires_at: parsed.data.expiresAt,
    max_files: parsed.data.maxFiles,
    photographer_name: parsed.data.photographerName || null,
    photographer_email: parsed.data.photographerEmail || null,
    instructions: parsed.data.instructions || null,
    created_by: session.userId,
  });
  if (error) return { ok: false, error: "Failed to create upload link" };

  revalidatePath("/upload-links");
  return { ok: true, token };
}

export async function revokeUploadToken(
  uploadTokenId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") {
    return { ok: false, error: "Only admins can revoke upload links" };
  }

  const db = await createClient();
  const { error } = await db
    .from("upload_tokens")
    .update({ expires_at: new Date().toISOString() })
    .eq("id", uploadTokenId);
  if (error) return { ok: false, error: "Failed to revoke" };

  revalidatePath("/upload-links");
  return { ok: true };
}
