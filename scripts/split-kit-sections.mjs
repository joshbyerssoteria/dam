/**
 * Split a kit's sections into individual kits inside a kit folder.
 * Mirrors the in-app "Convert to its own kit" action, in bulk.
 *
 * Usage:
 *   node scripts/split-kit-sections.mjs <kit-slug> <folder-name> [--dry]
 *
 * Files and section-matching palettes move by reference (no re-upload).
 * If the source kit is left with nothing (no assets, palettes, fonts, or
 * source file), it is deleted.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

const [kitSlug, folderName] = process.argv.slice(2);
const dryRun = process.argv.includes("--dry");
if (!kitSlug || !folderName) {
  console.log("Usage: node scripts/split-kit-sections.mjs <kit-slug> <folder-name> [--dry]");
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const { data: kit } = await db
  .from("kits")
  .select("*")
  .eq("slug", kitSlug)
  .single();
if (!kit) {
  console.error(`Kit not found: ${kitSlug}`);
  process.exit(1);
}

// Get or create the destination folder.
let { data: folder } = await db
  .from("kit_folders")
  .select("id, name")
  .eq("name", folderName)
  .maybeSingle();
if (!folder && !dryRun) {
  const { data: created, error } = await db
    .from("kit_folders")
    .insert({
      space_id: kit.space_id,
      name: folderName,
      slug: slugify(folderName) || "folder",
    })
    .select("id, name")
    .single();
  if (error) throw new Error(`kit_folders insert: ${error.message}`);
  folder = created;
}
console.log(
  `${dryRun ? "[DRY] " : ""}Splitting "${kit.name}" → folder "${folderName}"${folder ? ` (${folder.id})` : " (would create)"}\n`
);

const { data: sections } = await db
  .from("kit_sections")
  .select("*")
  .eq("kit_id", kit.id)
  .order("sort_order")
  .order("created_at");

for (const section of sections ?? []) {
  const { count: fileCount } = await db
    .from("kit_assets")
    .select("id", { count: "exact", head: true })
    .eq("section_id", section.id);
  const { data: palette } = await db
    .from("palettes")
    .select("id")
    .eq("kit_id", kit.id)
    .eq("name", section.name)
    .maybeSingle();

  // If a kit with this name already exists in the destination folder
  // (e.g. created manually), merge into it instead of duplicating.
  const { data: existingTarget } = folder
    ? await db
        .from("kits")
        .select("id, slug")
        .eq("kit_folder_id", folder.id)
        .eq("name", section.name)
        .maybeSingle()
    : { data: null };

  // Unique slug for a new kit.
  const base = slugify(section.name) || "kit";
  let slug = base;
  for (let suffix = 2; suffix < 50; suffix += 1) {
    const { data: taken } = await db
      .from("kits")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${suffix}`;
  }

  console.log(
    `  · "${section.name}" → ${
      existingTarget ? `MERGE into existing kit "${existingTarget.slug}"` : `kit "${slug}"`
    } (${fileCount ?? 0} files${palette ? " + palette" : ""})`
  );
  if (dryRun) continue;

  let newKit = existingTarget;
  if (!newKit) {
    const { data: created, error: kitError } = await db
      .from("kits")
      .insert({
        space_id: kit.space_id,
        name: section.name,
        slug,
        kit_folder_id: folder.id,
      })
      .select("id")
      .single();
    if (kitError) throw new Error(`kits insert: ${kitError.message}`);
    newKit = created;
  }

  const { error: moveError } = await db
    .from("kit_assets")
    .update({ kit_id: newKit.id, section_id: null })
    .eq("section_id", section.id);
  if (moveError) throw new Error(`kit_assets move: ${moveError.message}`);

  if (palette) {
    await db.from("palettes").update({ kit_id: newKit.id }).eq("id", palette.id);
    await db
      .from("kit_assets")
      .update({ kit_id: newKit.id })
      .eq("asset_type", "palette")
      .eq("asset_id", palette.id);
  }

  await db.from("kit_sections").delete().eq("id", section.id);
}

// Delete the source kit if it's now empty.
if (!dryRun) {
  const [{ count: assets }, { count: palettes }, { count: fonts }] =
    await Promise.all([
      db.from("kit_assets").select("id", { count: "exact", head: true }).eq("kit_id", kit.id),
      db.from("palettes").select("id", { count: "exact", head: true }).eq("kit_id", kit.id),
      db.from("fonts").select("id", { count: "exact", head: true }).eq("kit_id", kit.id),
    ]);
  if ((assets ?? 0) === 0 && (palettes ?? 0) === 0 && (fonts ?? 0) === 0 && !kit.source_file_id) {
    await db.from("kits").delete().eq("id", kit.id);
    console.log(`\nSource kit "${kit.name}" was empty — deleted.`);
  } else {
    console.log(
      `\nSource kit "${kit.name}" kept (${assets ?? 0} assets, ${palettes ?? 0} palettes, ${fonts ?? 0} fonts remain).`
    );
  }
}
console.log("Done.");
