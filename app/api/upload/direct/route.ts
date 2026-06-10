import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES, storeFile } from "@/lib/upload";
import {
  authorizeUploadIntent,
  finalizeUpload,
  keyPrefixForIntent,
  uploadIntentSchema,
} from "@/lib/upload-intents";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Small-file/local-dev upload path: the file travels through this function.
 * On Vercel, bodies over ~4.5 MB never reach us — the client uses the
 * presigned S3 path (/api/upload/presign + /complete) for those.
 */
export async function POST(request: Request) {
  const formData = await request.formData();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 413 });
  }

  const parsed = uploadIntentSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].filter(([, value]) => typeof value === "string")
    )
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }
  const intent = parsed.data;
  const mimeType = file.type || "application/octet-stream";

  const auth = await authorizeUploadIntent(intent, mimeType);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileRow = await storeFile(auth.db, {
    buffer,
    filename: file.name,
    mimeType,
    keyPrefix: keyPrefixForIntent(intent),
    uploadedBy: auth.uploadedBy,
  });

  const result = await finalizeUpload(auth, intent, fileRow);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, fileId: fileRow.id, photoId: result.photoId });
}
