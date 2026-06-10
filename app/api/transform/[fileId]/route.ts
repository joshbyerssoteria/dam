import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSessionProfile } from "@/lib/supabase/server";
import { createAdminClient, tryCreateAdminClient } from "@/lib/supabase/admin";
import { getObjectBuffer } from "@/lib/storage";
import {
  collectShareFileIds,
  isShareUnlocked,
  resolveShare,
  shareUnlockCookieName,
} from "@/lib/share-access";
import {
  clampTransformWidth,
  isTransformableMime,
  parseTransformFormat,
  TRANSFORM_CONTENT_TYPES,
  transformedFilename,
} from "@/lib/transform";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * On-demand format/size conversion (SPEC v2, pulled forward):
 *   /api/transform/[fileId]?format=png|jpg|webp&width=1200[&share=TOKEN]
 *
 * SVG sources rasterize at high density; raster sources convert/resize.
 * Accessible to signed-in users, or via a share token whose share contains
 * the file.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const url = new URL(request.url);

  const format = parseTransformFormat(url.searchParams.get("format"));
  if (!format) {
    return NextResponse.json(
      { error: "format must be png, jpg, or webp" },
      { status: 400 }
    );
  }
  const width = clampTransformWidth(Number(url.searchParams.get("width")) || null);
  const shareToken = url.searchParams.get("share");

  // --- authorize: session, or share token that includes this file
  const session = await getSessionProfile();
  if (!session) {
    if (!shareToken) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const admin = tryCreateAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Sharing not configured" }, { status: 503 });
    }
    const resolved = await resolveShare(admin, shareToken);
    if (!resolved) {
      return NextResponse.json({ error: "Link is no longer valid" }, { status: 404 });
    }
    const cookieStore = await cookies();
    if (
      !isShareUnlocked(
        resolved.share,
        cookieStore.get(shareUnlockCookieName(shareToken))?.value
      )
    ) {
      return NextResponse.json({ error: "Password required" }, { status: 401 });
    }
    const allowed = await collectShareFileIds(admin, resolved);
    if (!allowed.has(fileId)) {
      return NextResponse.json({ error: "Not part of this share" }, { status: 403 });
    }
  }

  // File lookup with service role (access already proven above).
  const db = createAdminClient();
  const { data: file } = await db
    .from("files")
    .select("*")
    .eq("id", fileId)
    .single();
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isTransformableMime(file.mime_type)) {
    return NextResponse.json(
      { error: `Cannot convert ${file.mime_type} — download the original instead` },
      { status: 415 }
    );
  }

  const original = await getObjectBuffer(file.s3_bucket, file.s3_key);

  // High density so SVGs rasterize crisply even when scaled up.
  let pipeline = sharp(original, {
    density: file.mime_type === "image/svg+xml" ? 300 : undefined,
  }).rotate();

  if (width) {
    pipeline = pipeline.resize(width, undefined, {
      withoutEnlargement: file.mime_type !== "image/svg+xml",
    });
  }

  const output =
    format === "png"
      ? await pipeline.png().toBuffer()
      : format === "jpg"
        ? await pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer()
        : await pipeline.webp({ quality: 92 }).toBuffer();

  const filename = transformedFilename(file.original_filename, format, width);
  return new NextResponse(new Uint8Array(output), {
    headers: {
      "Content-Type": TRANSFORM_CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
