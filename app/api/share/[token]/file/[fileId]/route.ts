import { createHash } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { getObjectBuffer, presignedGetUrl } from "@/lib/storage";
import {
  collectShareFileIds,
  isShareUnlocked,
  resolveShare,
  shareUnlockCookieName,
} from "@/lib/share-access";
import { isImageMime } from "@/lib/upload";

export const runtime = "nodejs";

const VARIANT_WIDTHS = [240, 480, 960, 1600] as const;

/** Serve a file through a share link — only files reachable by that share. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; fileId: string }> }
) {
  const { token, fileId } = await params;
  const admin = createAdminClient();

  const resolved = await resolveShare(admin, token);
  if (!resolved) {
    return NextResponse.json({ error: "Link is no longer valid" }, { status: 404 });
  }

  const cookieStore = await cookies();
  if (
    !isShareUnlocked(
      resolved.share,
      cookieStore.get(shareUnlockCookieName(token))?.value
    )
  ) {
    return NextResponse.json({ error: "Password required" }, { status: 401 });
  }

  const allowedFileIds = await collectShareFileIds(admin, resolved);
  if (!allowedFileIds.has(fileId)) {
    return NextResponse.json({ error: "Not part of this share" }, { status: 403 });
  }

  const { data: file } = await admin
    .from("files")
    .select("*")
    .eq("id", fileId)
    .single();
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";
  const requestedWidth = Number(url.searchParams.get("w")) || null;

  if (download) {
    const forwardedFor = request.headers.get("x-forwarded-for") ?? "unknown";
    const ipHash = createHash("sha256").update(forwardedFor).digest("hex").slice(0, 32);
    await admin
      .from("download_log")
      .insert({ share_token: token, file_id: fileId, ip_hash: ipHash });
    await admin
      .from("share_links")
      .update({ download_count: resolved.share.download_count + 1 })
      .eq("id", resolved.share.id);
  }

  if (
    requestedWidth &&
    !download &&
    isImageMime(file.mime_type) &&
    file.mime_type !== "image/svg+xml"
  ) {
    const width =
      VARIANT_WIDTHS.find((candidate) => candidate >= requestedWidth) ??
      VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]!;
    const original = await getObjectBuffer(file.s3_bucket, file.s3_key);
    const variant = await sharp(original)
      .rotate()
      .resize(width, undefined, { withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    return new NextResponse(new Uint8Array(variant), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const presigned = await presignedGetUrl(
    file.s3_bucket,
    file.s3_key,
    download ? file.original_filename : undefined
  );
  if (presigned) {
    return NextResponse.redirect(presigned);
  }

  const buffer = await getObjectBuffer(file.s3_bucket, file.s3_key);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": file.mime_type,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, max-age=3600",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="${encodeURIComponent(file.original_filename)}"`,
          }
        : {}),
    },
  });
}
