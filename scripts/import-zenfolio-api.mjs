/**
 * Automated Zenfolio (new platform / NextZen) → Soteria DAM migration.
 * Talks to the same internal API the dashboard uses, with a session bearer
 * token captured from the logged-in app.
 *
 * Recipe (reverse-engineered from app.zenfolio.com):
 *   GET  /api/folders/v1/folders/tree              → folder + album hierarchy
 *   GET  /api/folders/v1/folders/{albumId}/photos  → photos[] metadata
 *   PUT  /api/folders/v1/photos/download {albumId,photoId} → { downloadUrl }
 *        (downloadUrl serves the ORIGINAL; signed, ~2.5h TTL, minted per-photo)
 *
 * Usage:
 *   node scripts/import-zenfolio-api.mjs probe        # tree + counts + size
 *   node scripts/import-zenfolio-api.mjs import --dry # plan only
 *   node scripts/import-zenfolio-api.mjs import       # full run (resumable)
 *   node scripts/import-zenfolio-api.mjs import --album <id>   # one album
 *
 * Required in .env.local: ZENFOLIO_TOKEN (month-valid session JWT) and for
 * import: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, AWS_*,
 * S3_BUCKET_NAME.
 *
 * Idempotent: each photo's S3 key is photos/zenfolio/<photoId>/<file>; the
 * files row is skipped when that key already exists. Safe to stop/re-run.
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

const API = "https://app.zenfolio.com";
const CDN = "https://zenfolio.creatorcdn.com";
const TOKEN = process.env.ZENFOLIO_TOKEN;

const mode = process.argv[2];
const dryRun = process.argv.includes("--dry");
const onlyAlbum = process.argv.includes("--album")
  ? process.argv[process.argv.indexOf("--album") + 1]
  : null;

if (!mode || !["probe", "import"].includes(mode)) {
  console.log("Usage: node scripts/import-zenfolio-api.mjs <probe|import> [--dry] [--album <id>]");
  process.exit(1);
}
if (!TOKEN) {
  console.error("Missing ZENFOLIO_TOKEN in .env.local");
  process.exit(1);
}

/** fetch with an abort timeout so a stalled request can't hang a batch. */
async function fetchT(url, options = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function api(path, options = {}) {
  const r = await fetchT(API + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + TOKEN,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (r.status === 401) {
    throw new Error("Zenfolio token rejected (401) — recapture ZENFOLIO_TOKEN from the logged-in app.");
  }
  const text = await r.text();
  if (!r.ok) throw new Error(`${path} → ${r.status}: ${text.slice(0, 160)}`);
  return JSON.parse(text);
}

/**
 * Flatten the folder tree into albums with their group path.
 * Tree nodes use short keys: x=id, a=title, f=children, d=isFolder,
 * e=isAlbum(leaf), g=photoCount.
 */
function collectAlbums(node, path = []) {
  const out = [];
  const children = node.f ?? [];
  for (const child of children) {
    const isAlbum = child.e === true || (child.g != null && !(child.f && child.f.length));
    if (child.f && child.f.length && child.e !== true) {
      out.push(...collectAlbums(child, [...path, child.a]));
    } else if (isAlbum) {
      out.push({ id: child.x, title: child.a, photoCount: child.g ?? 0, path });
    }
  }
  return out;
}

function sanitize(name) {
  const base = String(name ?? "photo").split(/[/\\]/).pop() ?? "photo";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "photo";
}
function slugify(input) {
  return String(input)
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function bytes(n) {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(1)} ${u[i]}`;
}

async function albumPhotos(albumId) {
  const data = await api(`/api/folders/v1/folders/${albumId}/photos`);
  return data.photos ?? [];
}

async function downloadUrl(albumId, photoId) {
  const data = await api("/api/folders/v1/photos/download", {
    method: "PUT",
    body: JSON.stringify({ albumId, photoId }),
  });
  const raw = data.downloadUrl;
  return raw.startsWith("http") ? raw : CDN + raw;
}

// ---------------------------------------------------------------- probe
const tree = await api("/api/folders/v1/folders/tree");
const albums = collectAlbums({ f: tree.folderTree })
  .filter((album) => !onlyAlbum || album.id === onlyAlbum);

if (mode === "probe") {
  let totalPhotos = 0;
  console.log(`Folders: ${tree.foldersCount}, Albums: ${tree.albumsCount}\n`);
  for (const album of albums) {
    totalPhotos += album.photoCount;
    console.log(`  · ${[...album.path, album.title].join(" / ")} — ${album.photoCount} photos`);
  }
  // Size estimate from one real album's photo sizes.
  const sample = albums.find((a) => a.photoCount > 0);
  let estBytes = 0;
  if (sample) {
    const photos = await albumPhotos(sample.id);
    const sampleBytes = photos.reduce((s, p) => s + (p.size ?? 0), 0);
    const avg = sampleBytes / Math.max(photos.length, 1);
    estBytes = avg * totalPhotos;
    console.log(`\nSample "${sample.title}": ${photos.length} photos, ${bytes(sampleBytes)} (avg ${bytes(avg)})`);
  }
  console.log(`\nTOTAL: ${albums.length} albums, ${totalPhotos} photos`);
  console.log(`ESTIMATED SIZE: ~${bytes(estBytes)}`);
  process.exit(0);
}

// ---------------------------------------------------------------- import
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const s3 = new S3Client({ region: process.env.AWS_REGION });
const { data: spaceRow } = await supabase.from("spaces").select("id").limit(1).single();
if (!spaceRow) { console.error("No space row in DB."); process.exit(1); }

const folderCache = new Map();
async function ensureFolder(name, parentId) {
  const key = `${parentId ?? "root"}|${name}`;
  if (folderCache.has(key)) return folderCache.get(key);
  let q = supabase.from("folders").select("id").eq("name", name);
  q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
  const { data: existing } = await q.maybeSingle();
  if (existing) { folderCache.set(key, existing.id); return existing.id; }
  if (dryRun) { folderCache.set(key, "dry"); return "dry"; }
  const { data: created, error } = await supabase
    .from("folders")
    .insert({ space_id: spaceRow.id, parent_id: parentId, name, slug: slugify(name) || "folder" })
    .select("id").single();
  if (error) throw new Error(`folders insert: ${error.message}`);
  folderCache.set(key, created.id);
  return created.id;
}

const ARCHIVE_ROOT = "Photo Archive";
const CONCURRENCY = 10; // parallel download→S3 pipelines
let imported = 0, skipped = 0, failed = 0;
const started = Date.now();

async function importPhoto(album, folderId, photo) {
  const filename = sanitize(photo.fileName || photo.name || `photo-${photo.id}`);
  const key = `photos/zenfolio/${photo.id}/${filename}`;

  const { data: existing } = await supabase
    .from("files").select("id").eq("s3_key", key).maybeSingle();
  if (existing) { skipped += 1; return; }

  try {
    const url = await downloadUrl(album.id, photo.id);
    const resp = await fetchT(url, {}, 120000); // 2 min for large originals
    if (!resp.ok) throw new Error(`download ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    const contentType = resp.headers.get("content-type") || "image/jpeg";

    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME, Key: key, Body: buffer, ContentType: contentType,
    }));
    const { data: fileRow, error: fileError } = await supabase
      .from("files")
      .insert({
        s3_key: key, s3_bucket: process.env.S3_BUCKET_NAME, mime_type: contentType,
        original_filename: filename, file_size: buffer.byteLength,
        width: photo.width ?? null, height: photo.height ?? null, uploaded_by: null,
      })
      .select("id").single();
    if (fileError) throw new Error(fileError.message);

    const { error: photoError } = await supabase.from("photos").insert({
      folder_id: folderId, file_id: fileRow.id,
      taken_at: photo.dateCreated ?? null, ai_tags: [],
    });
    if (photoError) throw new Error(photoError.message);

    imported += 1;
    if (imported % 100 === 0) {
      const rate = imported / ((Date.now() - started) / 60000);
      const gb = (imported * 0.02).toFixed(1);
      console.log(`   … ${imported} imported (${failed} failed) — ${rate.toFixed(0)}/min, ~${gb}GB`);
    }
  } catch (error) {
    failed += 1;
    console.warn(`   ! ${filename}: ${error.message}`);
    if (/token rejected/.test(error.message)) process.exit(1);
  }
}

console.log(`${dryRun ? "[DRY RUN] " : ""}Importing ${albums.length} album(s), concurrency ${CONCURRENCY}…\n`);
const archiveRootId = dryRun ? "dry" : await ensureFolder(ARCHIVE_ROOT, null);

for (const album of albums) {
  let parentId = archiveRootId;
  for (const group of album.path) parentId = await ensureFolder(group, parentId);
  const folderId = await ensureFolder(album.title, parentId);

  const photos = await albumPhotos(album.id);
  console.log(`■ ${[...album.path, album.title].join(" / ")} — ${photos.length} photos`);
  if (dryRun) continue;

  // Continuous worker pool: a slow/timed-out photo never blocks the others.
  let cursor = 0;
  async function worker() {
    while (cursor < photos.length) {
      const photo = photos[cursor++];
      await importPhoto(album, folderId, photo);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, photos.length) }, worker)
  );
}

console.log(`\nDone. Imported ${imported}, skipped ${skipped}, failed ${failed}.`);
console.log("Next: node scripts/backfill-tags.mjs   # AI-tag the archive");
