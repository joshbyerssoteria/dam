import { NextResponse } from "next/server";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { getObjectBuffer } from "@/lib/storage";
import { sanitizeFilename } from "@/lib/upload";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Batch download: zip of selected photos. GET ?ids=<uuid,uuid,...> */
export async function GET(request: Request) {
  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 200);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No photos selected" }, { status: 400 });
  }

  const db = await createClient();
  const { data: photos } = await db
    .from("photos")
    .select("id, files(*)")
    .in("id", ids);

  const files = (photos ?? []).flatMap((photo) => {
    const file = photo.files as unknown as {
      s3_bucket: string;
      s3_key: string;
      original_filename: string;
    } | null;
    return file ? [file] : [];
  });
  if (files.length === 0) {
    return NextResponse.json({ error: "Nothing to download" }, { status: 404 });
  }

  const archive = archiver("zip", { zlib: { level: 1 } });
  const output = new PassThrough();
  archive.pipe(output);

  void (async () => {
    const usedNames = new Set<string>();
    try {
      for (const file of files) {
        const buffer = await getObjectBuffer(file.s3_bucket, file.s3_key);
        let name = sanitizeFilename(file.original_filename);
        if (usedNames.has(name)) {
          name = `${file.s3_key.split("/")[1]?.slice(0, 8) ?? "x"}-${name}`;
        }
        usedNames.add(name);
        archive.append(buffer, { name });
      }
      await archive.finalize();
    } catch (error) {
      archive.destroy(error instanceof Error ? error : new Error("zip failed"));
    }
  })();

  return new NextResponse(Readable.toWeb(output) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="photos.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
