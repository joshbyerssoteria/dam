import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database, ProfileRow } from "@/lib/database.types";

/** User-scoped client for server components, actions, and route handlers. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a server component — middleware handles refresh.
          }
        },
      },
    }
  );
}

/**
 * Current user + profile, or null when signed out. Cached per request.
 * Uses getClaims (local JWT verification with cached JWKS) instead of
 * getUser — avoids a network round-trip to the auth server on every page.
 */
export const getSessionProfile = cache(
  async (): Promise<{ userId: string; profile: ProfileRow } | null> => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (!userId) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (!profile) return null;

    return { userId, profile };
  }
);
