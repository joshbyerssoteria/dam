import { NextResponse } from "next/server";
import { z } from "zod";
import { presignedPutUrl, s3Configured, activeBucket } from "@/lib/storage";
import { generateStorageKey, MAX_PRESIGNED_BYTES } from "@/lib/upload";
import {
  authorizeUploadIntent,
  keyPrefixForIntent,
  uploadIntentSchema,
} from "@/lib/upload-intents";

export const runtime = "nodejs";

const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  fileSize: z.number().int().positive().max(MAX_PRESIGNED_BYTES),
  intent: uploadIntentSchema,
});

/**
 * Step 1 of the large-file path: authorize, then hand the browser a
 * presigned S3 PUT URL so the bytes never pass through the serverless
 * function (Vercel caps request bodies at ~4.5 MB). When S3 is not
 * configured (local dev), the client falls back to /api/upload/direct.
 */
export async function POST(request: Request) {
  const body = presignSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { filename, mimeType, fileSize, intent } = body.data;

  const auth = await authorizeUploadIntent(intent, mimeType);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!s3Configured()) {
    return NextResponse.json({ mode: "direct" });
  }

  const key = generateStorageKey(keyPrefixForIntent(intent), filename);
  const url = await presignedPutUrl(key, mimeType);
  if (!url) {
    return NextResponse.json({ mode: "direct" });
  }

  return NextResponse.json({
    mode: "s3",
    url,
    key,
    bucket: activeBucket(),
    maxBytes: MAX_PRESIGNED_BYTES,
    declaredSize: fileSize,
  });
}
