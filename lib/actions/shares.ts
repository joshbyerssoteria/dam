"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { generateShareToken, hashPassword } from "@/lib/tokens";

const createShareSchema = z.object({
  targetType: z.enum(["kit", "folder"]),
  targetId: z.string().uuid(),
  password: z.string().max(100),
  expiresAt: z.string().datetime().nullable(),
});

export async function createShareLink(input: {
  targetType: "kit" | "folder";
  targetId: string;
  password: string;
  expiresAt: string | null;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  const parsed = createShareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid share settings" };

  const token = generateShareToken();
  const passwordHash = parsed.data.password
    ? await hashPassword(parsed.data.password)
    : null;

  const db = await createClient();
  const { error } = await db.from("share_links").insert({
    token,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    password_hash: passwordHash,
    expires_at: parsed.data.expiresAt,
    created_by: session.userId,
  });
  if (error) return { ok: false, error: "Failed to create share link" };

  revalidatePath("/shares");
  return { ok: true, token };
}

/** Revocation per spec: set expires_at to now. */
export async function revokeShareLink(
  shareLinkId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  const db = await createClient();
  const { error } = await db
    .from("share_links")
    .update({ expires_at: new Date().toISOString() })
    .eq("id", shareLinkId);
  if (error) return { ok: false, error: "Failed to revoke link" };

  revalidatePath("/shares");
  return { ok: true };
}
