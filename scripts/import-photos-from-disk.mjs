/**
 * Import a downloaded photo archive (e.g. new-Zenfolio gallery exports)
 * from local disk into the DAM. Directory structure becomes the folder
 * hierarchy; ZIP files are auto-extracted in place (one directory per zip,
 * named after the zip).
 *
 * Usage:
 *   node scripts/import-photos-from-disk.mjs <root-dir> [--dry]
 *     [--root-folder "Zenfolio Archive"]   # wrap import in one top folder
 *     [--no-root]                          # children of root-dir become top-level folders
 *
 * Idempotent: S3 keys derive from each file's relative path, so re-runs
 * skip everything already imported. taken_at is left null (exports don't
 * carry reliable EXIF through every pipeline) — AI tagging supplies
 * searchable metadata via scripts/backfill-tags.mjs afterward.
 */

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { spawnSync } from "child_process";
import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync } from "fs";
import path from "path";
import sharp from "sharp";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

const args = process.argv.slice(2);
const rootDir = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry");
const noRoot = args.includes("--no-root");
const rootFolderName = args.includes("--root-folder")
  ? args[args.indexOf("--root-folder") + 1]
  : "Zenfolio Archive";

if (!rootDir || !existsSync(rootDir)) {
  console.log(
    'Usage: node scripts/import-photos-from-disk.mjs <root-dir> [--dry] [--root-folder "Name"] [--no-root]'
  );
  process.exit(1);
}
for (const key of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "AWS_REGION",
  "S3_BUCKET_NAME",
]) {
  if (!process.env[key] && !dryRun) {
    console.error(`Missing ${key} in .env.local`);
    process.exit(1);
  }
}

const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "tif", "tiff",
]);
const MIME_BY_EXT = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", gif: "image/gif", tif: "image/tiff", tiff: "image/tiff",
};

function sanitize(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "x";
}
function slugify(input) {
  return String(input)
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Extract any .zip files into sibling directories (named after the zip). */
function extractZips(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      extractZips(full);
    } else if (entry.toLowerCase().endsWith(".zip")) {
      const targetDir = full.replace(/\.zip$/i, "");
      if (!existsSync(targetDir)) {
        console.log(`  extracting ${entry}…`);
        mkdirSync(targetDir, { recursive: true });
        const result = spawnSync("unzip", ["-o", "-q", full, "-d", targetDir]);
        if (result.status !== 0) {
          console.warn(`  ! failed to extract ${entry}`);
        } else {
          extractZips(targetDir);
        }
      }
    }
  }
}

/** Walk the tree → [{ relDirParts: string[], files: string[] }]. */
function walk(dir, relParts = []) {
  const groups = [];
  const files = [];
  for (const entry of readdirSync(dir).sort()) {
    if (entry.startsWith(".") || entry.toLowerCase().endsWith(".zip")) continue;
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      groups.push(...walk(full, [...relParts, entry]));
    } else {
      const ext = entry.split(".").pop()?.toLowerCase() ?? "";
      if (IMAGE_EXTENSIONS.has(ext)) files.push(full);
    }
  }
  if (files.length > 0) groups.push({ relDirParts: relParts, files });
  return groups;
}

console.log(`Scanning ${rootDir}…`);
extractZips(rootDir);
const groups = walk(rootDir);
const totalFiles = groups.reduce((sum, group) => sum + group.files.length, 0);
console.log(`Found ${groups.length} folder group(s), ${totalFiles} image(s).\n`);

for (const group of groups) {
  const label = group.relDirParts.join(" / ") || "(root)";
  console.log(`  · ${label} — ${group.files.length} image(s)`);
}
if (dryRun) {
  console.log("\n[DRY RUN] Nothing imported.");
  process.exit(0);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const s3 = new S3Client({ region: process.env.AWS_REGION });

const { data: spaceRow } = await supabase.from("spaces").select("id").limit(1).single();

const folderCache = new Map();
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

let imported = 0;
let skipped = 0;
let failed = 0;

const baseFolderId = noRoot ? null : await ensureFolder(rootFolderName, null);

for (const group of groups) {
  let parentId = baseFolderId;
  for (const part of group.relDirParts) {
    parentId = await ensureFolder(part, parentId);
  }
  // Images directly in the root dir need a home.
  if (parentId === null) {
    parentId = await ensureFolder(rootFolderName, null);
  }

  console.log(`■ ${group.relDirParts.join(" / ") || rootFolderName}`);
  for (const filePath of group.files) {
    const relPath = path.relative(rootDir, filePath);
    // Deterministic key: short hash of the relative path + sanitized name.
    const hash = createHash("sha1").update(relPath).digest("hex").slice(0, 12);
    const filename = sanitize(path.basename(filePath));
    const key = `photos/disk-import/${hash}/${filename}`;

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
      const buffer = readFileSync(filePath);
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const contentType = MIME_BY_EXT[ext] ?? "image/jpeg";
      let width = null;
      let height = null;
      try {
        const meta = await sharp(buffer).rotate().metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch {
        // keep nulls
      }

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
          width,
          height,
          uploaded_by: null,
        })
        .select("id")
        .single();
      if (fileError) throw new Error(fileError.message);

      const { error: photoError } = await supabase.from("photos").insert({
        folder_id: parentId,
        file_id: fileRow.id,
        ai_tags: [],
      });
      if (photoError) throw new Error(photoError.message);
      imported += 1;
      if (imported % 100 === 0) console.log(`   … ${imported} imported`);
    } catch (error) {
      failed += 1;
      console.warn(`   ! ${relPath}: ${error.message}`);
    }
  }
}

console.log(`\nDone. Imported ${imported}, skipped ${skipped}, failed ${failed}.`);
console.log("Next: node scripts/backfill-tags.mjs   # AI-tag the new photos");
