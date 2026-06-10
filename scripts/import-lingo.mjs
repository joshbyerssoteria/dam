/**
 * One-time Lingo → Soteria DAM kit import (SPEC.md Open Question #2).
 * Uses the official @lingo-app/node SDK.
 *
 * Mapping:
 *   Lingo kit                  → kits row
 *   Lingo section              → kit_sections row
 *   image/file assets          → S3 object + files row + kit_assets (in section)
 *   color assets in a section  → one palette per section, colors in order
 *   font files (otf/ttf/woff)  → fonts + font_files
 *
 * Usage:
 *   node scripts/import-lingo.mjs probe          # read-only API inspection
 *   node scripts/import-lingo.mjs import --dry   # plan only, no writes
 *   node scripts/import-lingo.mjs import         # full import
 *   node scripts/import-lingo.mjs import --kit <uuid>
 *
 * Required in .env.local: LINGO_API_KEY, LINGO_SPACE_ID,
 * SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, AWS_REGION,
 * AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME.
 */

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import lingoModule from "@lingo-app/node";

// ---------------------------------------------------------------- env
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

const mode = process.argv[2];
const dryRun = process.argv.includes("--dry");
const onlyKit = process.argv.includes("--kit")
  ? process.argv[process.argv.indexOf("--kit") + 1]
  : null;

if (!mode || !["probe", "import"].includes(mode)) {
  console.log(
    "Usage: node scripts/import-lingo.mjs <probe|import> [--dry] [--kit <uuid>]"
  );
  process.exit(1);
}

if (!process.env.LINGO_API_KEY || !process.env.LINGO_SPACE_ID) {
  console.error("Missing LINGO_API_KEY / LINGO_SPACE_ID in .env.local");
  process.exit(1);
}
if (mode === "import" && !dryRun) {
  const needed = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "S3_BUCKET_NAME",
  ].filter((key) => !process.env[key]);
  if (needed.length > 0) {
    console.error("Missing in .env.local:", needed.join(", "));
    process.exit(1);
  }
}

// ---------------------------------------------------------------- lingo sdk
const lingo = lingoModule.default ?? lingoModule;
lingo.setup(process.env.LINGO_SPACE_ID, process.env.LINGO_API_KEY);

/** All items of a section across pages. */
async function fetchAllSectionItems(sectionUuid, version) {
  const items = [];
  let page = 1;
  for (;;) {
    const section = await lingo.fetchSection(sectionUuid, version, page, 200);
    const batch = section.items ?? [];
    items.push(...batch);
    if (batch.length < 200 || page > 50) break;
    page += 1;
  }
  return items;
}

// ---------------------------------------------------------------- helpers
function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeFilename(name) {
  const base = String(name ?? "file").split(/[/\\]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "file";
}

function assetFilename(asset) {
  const stem = asset?.name || `asset-${(asset?.uuid ?? "x").slice(0, 8)}`;
  const ext = (asset?.fileType ?? asset?.type ?? "").toLowerCase();
  const hasExt = /\.[a-z0-9]{1,5}$/i.test(stem);
  return sanitizeFilename(hasExt || !ext ? stem : `${stem}.${ext}`);
}

/** Lingo color assets store HSB percentages, not hex. */
function hsbToHex(hue, saturationPct, brightnessPct) {
  const s = saturationPct / 100;
  const v = brightnessPct / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;
  let [r, g, b] =
    hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
    : hue < 180 ? [0, c, x]
    : hue < 240 ? [0, x, c]
    : hue < 300 ? [x, 0, c]
    : [c, 0, x];
  const toHex = (value) =>
    Math.round((value + m) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function colorFromAsset(asset) {
  const color = asset?.colors?.[0];
  if (!color || color.hue == null) return null;
  return {
    hex: hsbToHex(color.hue, color.saturation ?? 0, color.brightness ?? 0),
    name: asset?.name || color?.name || null,
  };
}

const FONT_EXTENSIONS = new Set(["otf", "ttf", "woff", "woff2"]);
const MIME_BY_EXT = {
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", pdf: "application/pdf",
  ai: "application/postscript", eps: "application/postscript",
  psd: "image/vnd.adobe.photoshop", otf: "font/otf", ttf: "font/ttf",
  woff: "font/woff", woff2: "font/woff2", zip: "application/zip",
  mp4: "video/mp4", mov: "video/quicktime",
};

function assetType(asset) {
  return String(asset?.type ?? "").toUpperCase();
}

// ---------------------------------------------------------------- probe
if (mode === "probe") {
  console.log(`Probing Lingo space ${process.env.LINGO_SPACE_ID}…\n`);
  const kits = await lingo.fetchKits();
  console.log(`KITS (${kits.length}):`);
  for (const kit of kits) {
    console.log(`  · ${kit.name} (${kit.kitUuid ?? kit.kit_uuid ?? kit.uuid})`);
  }
  const first = kits[0];
  if (first) {
    const kitUuid = first.kitUuid ?? first.kit_uuid ?? first.uuid;
    const outline = await lingo.fetchKitOutline(kitUuid, 0);
    const sections = outline?.sections ?? [];
    console.log(`\nFIRST KIT "${first.name}" — ${sections.length} section(s):`);
    for (const section of sections) {
      console.log(`  · ${section.name} (${section.uuid})`);
    }
    if (sections[0]) {
      const items = await fetchAllSectionItems(sections[0].uuid, 0);
      console.log(`\nFIRST SECTION — ${items.length} item(s). Sample:`);
      console.log(JSON.stringify(items.slice(0, 3), null, 2).slice(0, 3000));
    }
  }
  process.exit(0);
}

// ---------------------------------------------------------------- import
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const s3 = dryRun ? null : new S3Client({ region: process.env.AWS_REGION });

const { data: spaceRow } = await supabase
  .from("spaces")
  .select("id")
  .limit(1)
  .single();
if (!spaceRow) {
  console.error("No space row found in the database.");
  process.exit(1);
}

const kits = await lingo.fetchKits();
const kitList = kits.filter(
  (kit) => !onlyKit || (kit.kitUuid ?? kit.kit_uuid ?? kit.uuid) === onlyKit
);
console.log(`${dryRun ? "[DRY RUN] " : ""}Importing ${kitList.length} kit(s)…\n`);

const summary = [];

for (const kitInfo of kitList) {
  const kitUuid = kitInfo.kitUuid ?? kitInfo.kit_uuid ?? kitInfo.uuid;
  const kitName = kitInfo.name ?? `Kit ${kitUuid}`;
  const slug = slugify(kitName) || `lingo-${kitUuid.slice(0, 8)}`;

  const { data: existing } = await supabase
    .from("kits")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    console.log(`■ ${kitName} — already exists (${slug}), skipping`);
    continue;
  }

  console.log(`■ ${kitName} (${slug})`);
  const outline = await lingo.fetchKitOutline(kitUuid, 0);
  const sections = outline?.sections ?? [];

  let kitId = null;
  if (!dryRun) {
    const { data: kitRow, error } = await supabase
      .from("kits")
      .insert({
        space_id: spaceRow.id,
        name: kitName,
        slug,
        description: kitInfo.description || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`kits insert: ${error.message}`);
    kitId = kitRow.id;
  }

  const counts = { files: 0, colors: 0, fonts: 0, sections: 0, skipped: 0 };

  for (const [sectionIndex, section] of sections.entries()) {
    const sectionName = section.name || `Section ${sectionIndex + 1}`;
    const items = await fetchAllSectionItems(section.uuid, 0);
    const assets = items
      .filter((item) => item.type === "asset" && (item.asset ?? item.data?.asset))
      .map((item) => item.asset ?? item.data?.asset);

    const colorAssets = assets.filter((asset) => assetType(asset) === "COLOR");
    const fileAssets = assets.filter((asset) => assetType(asset) !== "COLOR");

    console.log(
      `   · ${sectionName}: ${fileAssets.length} file(s), ${colorAssets.length} color(s)`
    );

    let sectionId = null;
    if (!dryRun && fileAssets.length > 0) {
      const { data: sectionRow, error } = await supabase
        .from("kit_sections")
        .insert({ kit_id: kitId, name: sectionName, sort_order: sectionIndex })
        .select("id")
        .single();
      if (error) throw new Error(`kit_sections insert: ${error.message}`);
      sectionId = sectionRow.id;
      counts.sections += 1;
    }

    if (colorAssets.length > 0) {
      const colors = colorAssets.map(colorFromAsset).filter(Boolean);
      counts.colors += colors.length;
      if (!dryRun && colors.length > 0) {
        const { data: palette, error } = await supabase
          .from("palettes")
          .insert({ kit_id: kitId, name: sectionName, sort_order: sectionIndex })
          .select("id")
          .single();
        if (error) throw new Error(`palettes insert: ${error.message}`);
        const { error: colorsError } = await supabase.from("colors").insert(
          colors.map((color, index) => ({
            palette_id: palette.id,
            hex: color.hex,
            name: color.name,
            sort_order: index,
          }))
        );
        if (colorsError) throw new Error(`colors insert: ${colorsError.message}`);
        await supabase.from("kit_assets").insert({
          kit_id: kitId,
          asset_type: "palette",
          asset_id: palette.id,
          sort_order: sectionIndex,
        });
      }
    }

    for (const [assetIndex, asset] of fileAssets.entries()) {
      const filename = assetFilename(asset);
      const ext = (filename.split(".").pop() ?? "").toLowerCase();
      if (dryRun) {
        counts[FONT_EXTENSIONS.has(ext) ? "fonts" : "files"] += 1;
        continue;
      }
      try {
        let buffer;
        try {
          buffer = await lingo.downloadAsset(asset.uuid, { type: "original" });
        } catch {
          // Fall back to the tokenized permalink the asset carries.
          if (!asset.permalink) throw new Error("no download URL");
          const response = await fetch(asset.permalink);
          if (!response.ok) throw new Error(`permalink → ${response.status}`);
          buffer = Buffer.from(await response.arrayBuffer());
        }
        const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
        const key = `kit-files/${randomUUID()}/${filename}`;
        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
          })
        );
        const { data: fileRow, error } = await supabase
          .from("files")
          .insert({
            s3_key: key,
            s3_bucket: process.env.S3_BUCKET_NAME,
            mime_type: contentType,
            original_filename: filename,
            file_size: buffer.byteLength,
            uploaded_by: null,
          })
          .select("id")
          .single();
        if (error) throw new Error(`files insert: ${error.message}`);

        if (FONT_EXTENSIONS.has(ext)) {
          const family = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
          const { data: font, error: fontError } = await supabase
            .from("fonts")
            .insert({ kit_id: kitId, family, source: "upload" })
            .select("id")
            .single();
          if (fontError) throw new Error(`fonts insert: ${fontError.message}`);
          await supabase
            .from("font_files")
            .insert({ font_id: font.id, file_id: fileRow.id });
          await supabase.from("kit_assets").insert({
            kit_id: kitId,
            asset_type: "font",
            asset_id: font.id,
            sort_order: assetIndex,
          });
          counts.fonts += 1;
        } else {
          await supabase.from("kit_assets").insert({
            kit_id: kitId,
            asset_type: "file",
            asset_id: fileRow.id,
            section_id: sectionId,
            sort_order: assetIndex,
          });
          counts.files += 1;
        }
      } catch (error) {
        console.warn(`     ! skipped ${filename}: ${error.message}`);
        counts.skipped += 1;
      }
    }
  }

  summary.push({ kit: kitName, ...counts });
}

console.log("\nDone.");
console.table(summary);
