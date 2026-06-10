import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, writeFile } from "fs/promises";
import { createReadStream, existsSync } from "fs";
import path from "path";
import { Readable } from "stream";

/**
 * Object storage with two backends:
 *  - S3 when AWS credentials are configured (production)
 *  - local disk under .uploads/ otherwise (development/beta without AWS)
 *
 * Rows in `files` record s3_bucket = LOCAL_BUCKET for disk-stored objects, so
 * the two can coexist if credentials are added later.
 */

export const LOCAL_BUCKET = "_local";
const LOCAL_DIR = path.join(process.cwd(), ".uploads");

export function s3Configured(): boolean {
  return Boolean(
    process.env.AWS_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET_NAME
  );
}

export function activeBucket(): string {
  return s3Configured() ? process.env.S3_BUCKET_NAME! : LOCAL_BUCKET;
}

let s3: S3Client | null = null;
function s3Client(): S3Client {
  if (!s3) {
    s3 = new S3Client({ region: process.env.AWS_REGION });
  }
  return s3;
}

function localPath(key: string): string {
  // Keys are server-generated (uuid/filename) — normalize defensively anyway.
  const safe = path.normalize(key).replace(/^(\.\.[/\\])+/, "");
  return path.join(LOCAL_DIR, safe);
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<{ bucket: string }> {
  if (s3Configured()) {
    await s3Client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    return { bucket: process.env.S3_BUCKET_NAME! };
  }

  const filePath = localPath(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
  return { bucket: LOCAL_BUCKET };
}

export async function getObjectBuffer(
  bucket: string,
  key: string
): Promise<Buffer> {
  if (bucket !== LOCAL_BUCKET) {
    const result = await s3Client().send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object: ${bucket}/${key}`);
    return Buffer.from(bytes);
  }
  return readFile(localPath(key));
}

export function getObjectStream(bucket: string, key: string): Readable | null {
  if (bucket === LOCAL_BUCKET) {
    const filePath = localPath(key);
    if (!existsSync(filePath)) return null;
    return createReadStream(filePath);
  }
  return null; // S3 objects stream via presigned URL redirect instead.
}

/** Presigned GET URL for S3 objects; null for local-disk objects. */
export async function presignedGetUrl(
  bucket: string,
  key: string,
  filename?: string
): Promise<string | null> {
  if (bucket === LOCAL_BUCKET) return null;
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(filename
        ? {
            ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
          }
        : {}),
    }),
    { expiresIn: 60 * 15 }
  );
}
