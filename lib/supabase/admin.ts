import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Service-role client. Bypasses RLS — use ONLY in server code that has
 * already validated access by other means (share tokens, upload tokens,
 * background jobs). Never import from client components.
 */
export function createAdminClient() {
  const client = tryCreateAdminClient();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Public share and upload flows require it."
    );
  }
  return client;
}

/** Null when the service role key is not configured — callers degrade gracefully. */
export function tryCreateAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
