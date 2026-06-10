// Mint a magic-link sign-in URL via the Supabase Admin API — no email sent,
// not subject to the email rate limit. For dev/testing access.
//
// Usage: node scripts/login-link.mjs you@soteria.church
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env.local without extra deps.
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/login-link.mjs <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://assets.soteria.church";
if (!serviceKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { redirectTo: `${appUrl}/auth/callback?next=/photos` },
});

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}

console.log("\nOpen this URL in your browser to sign in as", email, ":\n");
console.log(data.properties.action_link, "\n");
