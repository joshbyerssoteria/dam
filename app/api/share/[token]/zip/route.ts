import { createHash } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import { createAdminClient } from "@/lib/supabase/admin";
import { getObjectBuffer } from "@/lib/storage";
import {
  collectShareFileIds,
  isShareUnlocked,
  resolveShare,
  shareUnlockCookieName,
} from "@/lib/share-access";
import { sanitizeFilename } from "@/lib/upload";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Download-all: streams a zip of every file reachable by the share. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
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

  const fileIds = [...(await collectShareFileIds(admin, resolved))];
  if (fileIds.length === 0) {
    return NextResponse.json({ error: "Nothing to download" }, { status: 404 });
  }

  const { data: files } = await admin
    .from("files")
    .select("*")
    .in("id", fileIds);
  const fileList = files ?? [];

  const targetName =
    resolved.targetType === "kit" ? resolved.kit.name : resolved.folder.name;
  const zipName = `${sanitizeFilename(targetName) || "share"}.zip`;

  // Audit: one log row per file, single count increment per zip.
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "unknown";
  const ipHash = createHash("sha256").update(forwardedFor).digest("hex").slice(0, 32);
  await admin.from("download_log").insert(
    fileList.map((file) => ({
      share_token: token,
      file_id: file.id,
      ip_hash: ipHash,
    }))
  );
  await admin
    .from("share_links")
    .update({ download_count: resolved.share.download_count + 1 })
    .eq("id", resolved.share.id);

  const archive = archiver("zip", { zlib: { level: 1 } });
  const output = new PassThrough();
  archive.pipe(output);

  // Append sequentially in the background while the response streams.
  void (async () => {
    const usedNames = new Set<string>();
    try {
      for (const file of fileList) {
        const buffer = await getObjectBuffer(file.s3_bucket, file.s3_key);
        let name = sanitizeFilename(file.original_filename);
        if (usedNames.has(name)) {
          name = `${file.id.slice(0, 8)}-${name}`;
        }
        usedNames.add(name);
        archive.append(buffer, { name });
      }
      await archive.finalize();
    } catch (error) {
      archive.destroy(
        error instanceof Error ? error : new Error("zip failed")
      );
    }
  })();

  return new NextResponse(Readable.toWeb(output) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "no-store",
    },
  });
}
