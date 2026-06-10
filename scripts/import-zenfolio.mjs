/**
 * One-time Zenfolio → Soteria DAM photo migration (SPEC.md Open Question #1).
 * Uses Zenfolio's Classic API v1.8 over JSON-RPC.
 *
 * Mapping:
 *   Group (folder)      → folders row (nested via parent_id)
 *   PhotoSet "Gallery"  → folders row containing its photos
 *   PhotoSet "Collection" → skipped (pointers to gallery photos; would dupe)
 *   Photo original      → S3 + files row + photos row (taken_at preserved)
 *
 * Usage:
 *   node scripts/import-zenfolio.mjs probe          # tree + archive size estimate
 *   node scripts/import-zenfolio.mjs import --dry   # plan only
 *   node scripts/import-zenfolio.mjs import         # full import (resumable)
 *   node scripts/import-zenfolio.mjs import --gallery <id>   # single gallery
 *
 * Required in .env.local: ZENFOLIO_USERNAME, ZENFOLIO_PASSWORD, and for
 * import: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, AWS_*,
 * S3_BUCKET_NAME.
 *
 * Idempotent: photos store under a deterministic key
 * (photos/zenfolio/<photoId>/...) and are skipped when already present.
 */

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

const API = "https://api.zenfolio.com/api/1.8/zfapi.asmx";
const mode = process.argv[2];
const dryRun = process.argv.includes("--dry");
const onlyGallery = process.argv.includes("--gallery")
  ? Number(process.argv[process.argv.indexOf("--gallery") + 1])
  : null;

if (!mode || !["probe", "import"].includes(mode)) {
  console.log("Usage: node scripts/import-zenfolio.mjs <probe|import> [--dry] [--gallery <id>]");
  process.exit(1);
}
if (!process.env.ZENFOLIO_USERNAME || !process.env.ZENFOLIO_PASSWORD) {
  console.error("Missing ZENFOLIO_USERNAME / ZENFOLIO_PASSWORD in .env.local");
  process.exit(1);
}

// ---------------------------------------------------------------- rpc
let zfToken = null;
let rpcId = 0;

async function rpc(method, params) {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "SoteriaDAM-Migration/1.0",
      ...(zfToken ? { "X-Zenfolio-Token": zfToken } : {}),
    },
    body: JSON.stringify({ method, params, id: ++rpcId }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} → HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text);
  if (json.error) {
    throw new Error(`${method} → ${JSON.stringify(json.error).slice(0, 300)}`);
  }
  return json.result;
}

async function authenticate() {
  zfToken = await rpc("AuthenticatePlain", [
    process.env.ZENFOLIO_USERNAME,
    process.env.ZENFOLIO_PASSWORD,
  ]);
  if (!zfToken) throw new Error("Authentication returned no token");
}

// ---------------------------------------------------------------- tree
function isGroup(element) {
  return element?.$type === "Group";
}
function isGallery(element) {
  return element?.$type === "PhotoSet" && element?.Type === "Gallery";
}

/** Flatten hierarchy into [{ gallery, path: [group titles...] }]. */
function collectGalleries(group, path = []) {
  const results = [];
  for (const element of group?.Elements ?? []) {
    if (isGroup(element)) {
      results.push(...collectGalleries(element, [...path, element.Title]));
    } else if (isGallery(element)) {
      results.push({ gallery: element, path });
    }
  }
  return results;
}

async function loadAllPhotos(photoSetId, expectedCount) {
  const photos = [];
  for (let start = 0; start < (expectedCount || 100000); start += 256) {
    const batch = await rpc("LoadPhotoSetPhotos", [photoSetId, start, 256]);
    photos.push(...(batch ?? []));
    if (!batch || batch.length < 256) break;
  }
  return photos;
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function sanitizeFilename(name) {
  const base = String(name ?? "photo").split(/[/\\]/).pop() ?? "photo";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "photo";
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function photoFilename(photo) {
  const name = photo.FileName || photo.Title || `photo-${photo.Id}`;
  return sanitizeFilename(name);
}

function originalUrl(photo) {
  if (photo.OriginalUrl) return photo.OriginalUrl;
  // Owner-authenticated fallback: UrlCore-based original.
  if (photo.UrlHost && photo.UrlCore) {
    return `https://${photo.UrlHost}${photo.UrlCore}-orig.jpg${photo.UrlToken ? `?tk=${photo.UrlToken}` : ""}`;
  }
  return null;
}

async function downloadPhoto(photo) {
  const url = originalUrl(photo);
  if (!url) throw new Error("no original URL");
  const response = await fetch(url, {
    headers: { "X-Zenfolio-Token": zfToken, "User-Agent": "SoteriaDAM-Migration/1.0" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`download → ${response.status}`);
  const contentType = response.headers.get("content-type") ?? photo.MimeType ?? "image/jpeg";
  return { buffer: Buffer.from(await response.arrayBuffer()), contentType };
}

/** Zenfolio's /Date(1234567890000)/ or ISO strings → ISO. */
function parseZenfolioDate(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/\/Date\((\d+)/);
    if (match) return new Date(Number(match[1])).toISOString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

// ---------------------------------------------------------------- probe
await authenticate();
console.log("Authenticated with Zenfolio.\n");
const hierarchy = await rpc("LoadGroupHierarchy", [process.env.ZENFOLIO_USERNAME]);
const galleries = collectGalleries(hierarchy);

if (mode === "probe") {
  let totalPhotos = 0;
  let totalBytes = 0;
  console.log(`GALLERIES (${galleries.length}):`);
  for (const { gallery, path } of galleries) {
    totalPhotos += gallery.PhotoCount ?? 0;
    console.log(
      `  · ${[...path, gallery.Title].join(" / ")} — ${gallery.PhotoCount ?? 0} photos (id ${gallery.Id})`
    );
  }

  // Sample real photo objects from the first non-empty gallery to confirm
  // field shapes and sum exact sizes for an estimate.
  const sample = galleries.find(({ gallery }) => (gallery.PhotoCount ?? 0) > 0);
  if (sample) {
    const photos = await loadAllPhotos(sample.gallery.Id, sample.gallery.PhotoCount);
    const sampleBytes = photos.reduce((sum, photo) => sum + (photo.Size ?? 0), 0);
    const averageBytes = sampleBytes / Math.max(photos.length, 1);
    totalBytes = averageBytes * totalPhotos;
    console.log(
      `\nSample gallery "${sample.gallery.Title}": ${photos.length} photos, ${formatBytes(sampleBytes)} (avg ${formatBytes(averageBytes)})`
    );
    console.log("\nSAMPLE PHOTO OBJECT:");
    console.log(JSON.stringify(photos[0], null, 2).slice(0, 2000));
  }

  console.log(`\nTOTAL: ${galleries.length} galleries, ${totalPhotos} photos`);
  console.log(`ESTIMATED ARCHIVE SIZE: ~${formatBytes(totalBytes)} (extrapolated from sample average)`);
  process.exit(0);
}

// ---------------------------------------------------------------- import
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const s3 = dryRun ? null : new S3Client({ region: process.env.AWS_REGION });

const { data: spaceRow } = await supabase.from("spaces").select("id").limit(1).single();
if (!spaceRow) {
  console.error("No space row in database.");
  process.exit(1);
}

/** Get or create a folder by name under a parent. */
const folderCache = new Map(); // `${parentId}|${name}` → id
async function ensureFolder(name, parentId) {
  const key = `${parentId ?? "root"}|${name}`;
  if (folderCache.has(key)) return folderCache.get(key);

  let query = supabase.from("folders").select("id").eq("name", name);
  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
  const { data: existing } = await query.maybeSingle();
  if (existing) {
    folderCache.set(key, existing.id);
    return existing.id;
  }
  if (dryRun) {
    folderCache.set(key, `dry-${key}`);
    return folderCache.get(key);
  }
  const { data: created, error } = await supabase
    .from("folders")
    .insert({
      space_id: spaceRow.id,
      parent_id: parentId,
      name,
      slug: slugify(name) || "folder",
    })
    .select("id")
    .single();
  if (error) throw new Error(`folders insert: ${error.message}`);
  folderCache.set(key, created.id);
  return created.id;
}

const targetGalleries = galleries.filter(
  ({ gallery }) => !onlyGallery || gallery.Id === onlyGallery
);
console.log(`${dryRun ? "[DRY RUN] " : ""}Importing ${targetGalleries.length} galleries…\n`);

let imported = 0;
let skipped = 0;
let failed = 0;

for (const { gallery, path } of targetGalleries) {
  // Build the folder chain: groups → nested folders, gallery → leaf folder.
  let parentId = null;
  for (const groupName of path) {
    parentId = await ensureFolder(groupName, parentId);
  }
  const folderId = await ensureFolder(gallery.Title, parentId);

  const photos = await loadAllPhotos(gallery.Id, gallery.PhotoCount);
  console.log(`■ ${[...path, gallery.Title].join(" / ")} — ${photos.length} photos`);
  if (dryRun) continue;

  for (const photo of photos) {
    const filename = photoFilename(photo);
    const key = `photos/zenfolio/${photo.Id}/${filename}`;

    // Idempotency: deterministic key — skip when already recorded.
    const { data: existing } = await supabase
      .from("files")
      .select("id")
      .eq("s3_key", key)
      .maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }

    try {
      const { buffer, contentType } = await downloadPhoto(photo);
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );
      const { data: fileRow, error: fileError } = await supabase
        .from("files")
        .insert({
          s3_key: key,
          s3_bucket: process.env.S3_BUCKET_NAME,
          mime_type: contentType,
          original_filename: filename,
          file_size: buffer.byteLength,
          width: photo.Width ?? null,
          height: photo.Height ?? null,
          uploaded_by: null,
        })
        .select("id")
        .single();
      if (fileError) throw new Error(`files insert: ${fileError.message}`);

      const { error: photoError } = await supabase.from("photos").insert({
        folder_id: folderId,
        file_id: fileRow.id,
        taken_at: parseZenfolioDate(photo.TakenOn ?? photo.UploadedOn),
        ai_tags: [],
      });
      if (photoError) throw new Error(`photos insert: ${photoError.message}`);
      imported += 1;
      if (imported % 50 === 0) console.log(`   … ${imported} imported`);
    } catch (error) {
      failed += 1;
      console.warn(`   ! ${filename} (${photo.Id}): ${error.message}`);
    }
  }
}

console.log(
  `\nDone. Imported ${imported}, skipped ${skipped} (already present), failed ${failed}.`
);
if (!dryRun && imported > 0) {
  console.log(
    "\nNote: AI tagging runs through Inngest, which isn't configured yet —"
  );
  console.log(
    "imported photos have no tags until the pipeline is enabled and backfilled."
  );
}
