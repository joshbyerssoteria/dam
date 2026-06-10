import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface GoogleFamily {
  family: string;
  category: string;
}

// Google's public metadata endpoint — no API key required.
const METADATA_URL = "https://fonts.google.com/metadata/fonts";

let cache: { at: number; families: GoogleFamily[] } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Searchable list of Google Fonts families for the add-font picker. */
export async function GET() {
  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!cache || Date.now() - cache.at > CACHE_TTL_MS) {
    const response = await fetch(METADATA_URL, {
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not reach Google Fonts" },
        { status: 502 }
      );
    }
    // Some responses are prefixed with an XSSI guard `)]}'`.
    const raw = (await response.text()).replace(/^\)\]\}'\s*/, "");
    const parsed = JSON.parse(raw) as {
      familyMetadataList?: Array<{ family: string; category: string }>;
    };
    cache = {
      at: Date.now(),
      families: (parsed.familyMetadataList ?? []).map((item) => ({
        family: item.family,
        category: item.category,
      })),
    };
  }

  return NextResponse.json(
    { families: cache.families },
    { headers: { "Cache-Control": "private, max-age=3600" } }
  );
}
