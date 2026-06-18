import { NextResponse } from "next/server";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { getObjectBuffer, presignedGetUrl } from "@/lib/storage";
import { isImageMime } from "@/lib/upload";
import { isFontFile } from "@/lib/file-kinds";
import { isPdfLike, renderPdfFirstPage } from "@/lib/pdf-preview";
import { isPsd, renderPsdThumbnail } from "@/lib/psd-preview";
import { loadImage } from "@/lib/image-decode";

export const runtime = "nodejs";

const VARIANT_WIDTHS = [240, 480, 960, 1600] as const;

/**
 * Serve a stored file to a signed-in user.
 *   ?w=480       resized JPEG/WebP variant (images only, snapped to fixed widths)
 *   ?download=1  Content-Disposition: attachment at original quality
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { fileId } = await params;
  const db = await createClient();
  const { data: file } = await db
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

  // Resized variant for grid/lightbox rendering. PDF-like files (PDF, .ai)
  // render their first page/artboard.
  const pdfLike = isPdfLike(file.mime_type, file.original_filename);
  const psd = isPsd(file.mime_type, file.original_filename);
  if (
    requestedWidth &&
    !download &&
    ((isImageMime(file.mime_type) && file.mime_type !== "image/svg+xml") ||
      pdfLike)
  ) {
    const width =
      VARIANT_WIDTHS.find((candidate) => candidate >= requestedWidth) ??
      VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]!;
    const original = await getObjectBuffer(file.s3_bucket, file.s3_key);
    let source = original;
    if (pdfLike || psd) {
      try {
        source = pdfLike
          ? await renderPdfFirstPage(original, width)
          : await renderPsdThumbnail(original);
      } catch {
        return NextResponse.json(
          { error: "No preview available" },
          { status: 415 }
        );
      }
    }
    const variant = await (await loadImage(source))
      .rotate()
      // PSD previews come from the small embedded thumbnail, so allow
      // enlargement to fill the requested width.
      .resize(width, undefined, { withoutEnlargement: !psd })
      .webp({ quality: 78 })
      .toBuffer();
    return new NextResponse(new Uint8Array(variant), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=86400",
      },
    });
  }

  // Original: redirect to presigned S3 URL when available, else stream.
  // Fonts are streamed same-origin (never redirected) so @font-face can
  // load them without cross-origin CORS headers from S3.
  const serveFontInline = !download && isFontFile(file.mime_type, file.original_filename);
  const presigned = serveFontInline
    ? null
    : await presignedGetUrl(
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
      "Cache-Control": "private, max-age=86400",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="${encodeURIComponent(file.original_filename)}"`,
          }
        : {}),
    },
  });
}
