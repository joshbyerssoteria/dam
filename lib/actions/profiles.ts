"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/database.types";

const ROLES: AppRole[] = ["admin", "editor", "viewer"];

export async function updateUserRole(
  userId: string,
  role: AppRole
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") {
    return { ok: false, error: "Only admins can change roles" };
  }
  if (!ROLES.includes(role)) return { ok: false, error: "Invalid role" };
  if (userId === session.userId) {
    return { ok: false, error: "You cannot change your own role" };
  }

  const db = await createClient();
  const { error } = await db
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { ok: false, error: "Failed to update role" };

  revalidatePath("/settings");
  return { ok: true };
}

export async function updateDisplayName(
  displayName: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Not signed in" };

  const db = await createClient();
  const { error } = await db
    .from("profiles")
    .update({ display_name: displayName.trim() || null })
    .eq("id", session.userId);
  if (error) return { ok: false, error: "Failed to update name" };

  revalidatePath("/settings");
  return { ok: true };
}
