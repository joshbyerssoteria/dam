"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveShare,
  shareUnlockCookieName,
  shareUnlockCookieValue,
} from "@/lib/share-access";
import { verifyPassword } from "@/lib/tokens";

export async function unlockShare(
  token: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const resolved = await resolveShare(admin, token);
  if (!resolved) return { ok: false, error: "This link is no longer valid" };
  if (!resolved.share.password_hash) return { ok: true };

  const valid = await verifyPassword(password, resolved.share.password_hash);
  if (!valid) return { ok: false, error: "Incorrect password" };

  const cookieStore = await cookies();
  cookieStore.set(
    shareUnlockCookieName(token),
    shareUnlockCookieValue(resolved.share),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 4,
      path: "/",
    }
  );
  return { ok: true };
}
