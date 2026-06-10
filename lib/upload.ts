import { randomUUID } from "crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FileRow } from "@/lib/database.types";
import { activeBucket, putObject } from "@/lib/storage";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "file";
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
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

  let width: number | null = null;
  let height: number | null = null;
  if (isImageMime(mimeType) && mimeType !== "image/svg+xml") {
    try {
      const meta = await sharp(buffer).rotate().metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {
      // Not a decodable raster — store without dimensions.
    }
  }

  const safeName = sanitizeFilename(filename);
  const key = `${keyPrefix}/${randomUUID()}/${safeName}`;
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
