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

/**
 * One-click share: reuse an existing live, passwordless link for the target,
 * or create one. Returns the public path for the clipboard.
 */
export async function quickShare(
  targetType: "kit" | "folder",
  targetId: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") {
    return { ok: false, error: "Not allowed" };
  }

  const db = await createClient();
  const prefix = targetType === "kit" ? "/k" : "/f";

  const { data: existing } = await db
    .from("share_links")
    .select("token, expires_at, password_hash")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .is("password_hash", null)
    .order("created_at", { ascending: false })
    .limit(10);
  const live = (existing ?? []).find(
    (link) => !link.expires_at || new Date(link.expires_at).getTime() > Date.now()
  );
  if (live) {
    return { ok: true, path: `${prefix}/${live.token}` };
  }

  const token = generateShareToken();
  const { error } = await db.from("share_links").insert({
    token,
    target_type: targetType,
    target_id: targetId,
    created_by: session.userId,
  });
  if (error) return { ok: false, error: "Failed to create share link" };

  revalidatePath("/shares");
  return { ok: true, path: `${prefix}/${token}` };
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
