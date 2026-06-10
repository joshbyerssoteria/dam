import { NextResponse } from "next/server";
import { z } from "zod";
import { activeBucket, headObjectSize } from "@/lib/storage";
import { registerStoredFile } from "@/lib/upload";
import {
  authorizeUploadIntent,
  finalizeUpload,
  keyPrefixForIntent,
  uploadIntentSchema,
} from "@/lib/upload-intents";

export const runtime = "nodejs";
export const maxDuration = 60;

const completeSchema = z.object({
  key: z.string().min(1).max(500),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  intent: uploadIntentSchema,
});

/**
 * Step 2 of the large-file path: after the browser PUTs to S3, record the
 * file and create domain rows. Verifies the object actually exists and that
 * the key belongs to the intent's namespace.
 */
export async function POST(request: Request) {
  const body = completeSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { key, filename, mimeType, intent } = body.data;

  const auth = await authorizeUploadIntent(intent, mimeType);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // The key must be in the namespace this intent is allowed to write.
  if (!key.startsWith(`${keyPrefixForIntent(intent)}/`) || key.includes("..")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const bucket = activeBucket();
  const actualSize = await headObjectSize(bucket, key);
  if (actualSize === null) {
    return NextResponse.json(
      { error: "Upload not found in storage — did the transfer finish?" },
      { status: 400 }
    );
  }

  try {
    const file = await registerStoredFile(auth.db, {
      key,
      bucket,
      filename,
      mimeType,
      fileSize: actualSize,
      uploadedBy: auth.uploadedBy,
    });

    const result = await finalizeUpload(auth, intent, file);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, fileId: file.id, photoId: result.photoId });
  } catch (error) {
    // Duplicate completion of the same key → unique violation on s3_key.
    const message = error instanceof Error ? error.message : "Failed to record file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
