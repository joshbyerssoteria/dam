import { randomUUID } from "crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FileRow } from "@/lib/database.types";
import { activeBucket, getObjectBuffer, putObject } from "@/lib/storage";

// Direct uploads pass through the serverless function; Vercel rejects bodies
// over ~4.5 MB, so this path is only for small files and local dev. Large
// files go browser → S3 via presigned PUT (see /api/upload/presign).
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB (local/direct)
export const MAX_PRESIGNED_BYTES = 500 * 1024 * 1024; // 500 MB (S3 direct)

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "file";
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function generateStorageKey(keyPrefix: string, filename: string): string {
  return `${keyPrefix}/${randomUUID()}/${sanitizeFilename(filename)}`;
}

async function imageDimensions(
  buffer: Buffer,
  mimeType: string
): Promise<{ width: number | null; height: number | null }> {
  if (!isImageMime(mimeType) || mimeType === "image/svg+xml") {
    return { width: null, height: null };
  }
  try {
    const meta = await sharp(buffer).rotate().metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

/**
 * Record a files row for an object already in storage (presigned-upload
 * path). Reads the object back only when it's an image, to get dimensions.
 */
export async function registerStoredFile(
  db: SupabaseClient<Database>,
  options: {
    key: string;
    bucket: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    uploadedBy: string | null;
  }
): Promise<FileRow> {
  const { key, bucket, filename, mimeType, fileSize, uploadedBy } = options;

  let width: number | null = null;
  let height: number | null = null;
  if (isImageMime(mimeType) && mimeType !== "image/svg+xml") {
    try {
      const buffer = await getObjectBuffer(bucket, key);
      ({ width, height } = await imageDimensions(buffer, mimeType));
    } catch {
      // Dimensions are best-effort.
    }
  }

  const { data: file, error } = await db
    .from("files")
    .insert({
      s3_key: key,
      s3_bucket: bucket,
      mime_type: mimeType,
      original_filename: filename,
      file_size: fileSize,
      width,
      height,
      uploaded_by: uploadedBy,
    })
    .select("*")
    .single();

  if (error || !file) {
    throw new Error(`Failed to record file: ${error?.message}`);
  }
  return file;
}

/**
 * Store an uploaded blob and create its `files` row.
 * Caller is responsible for authorization.
 */
export async function storeFile(
  db: SupabaseClient<Database>,
  options: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    keyPrefix: string;
    uploadedBy: string | null;
  }
): Promise<FileRow> {
  const { buffer, filename, mimeType, keyPrefix, uploadedBy } = options;

  const { width, height } = await imageDimensions(buffer, mimeType);
  const key = generateStorageKey(keyPrefix, filename);
  await putObject(key, buffer, mimeType);

  const { data: file, error } = await db
    .from("files")
    .insert({
      s3_key: key,
      s3_bucket: activeBucket(),
      mime_type: mimeType,
      original_filename: filename,
      file_size: buffer.byteLength,
      width,
      height,
      uploaded_by: uploadedBy,
    })
    .select("*")
    .single();

  if (error || !file) {
    throw new Error(`Failed to record file: ${error?.message}`);
  }
  return file;
}
