"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import type { KitRow } from "@/lib/database.types";
import { getObjectBuffer } from "@/lib/storage";
import {
  extractPaletteSuggestion,
  type SuggestedColor,
} from "@/lib/palette-extract";
import { slugify } from "@/lib/utils";

async function requireEditor() {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") return null;
  return session;
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Accept a YYYY-MM-DD string, otherwise null (blank/invalid clears the date). */
function normalizeDate(value: string | null | undefined): string | null {
  return value && DATE_RE.test(value) ? value : null;
}

/** True when the folder is the static Sermon Series folder (date-ranged kits). */
async function isSermonSeriesFolder(
  db: Awaited<ReturnType<typeof createClient>>,
  kitFolderId: string | null | undefined
): Promise<boolean> {
  if (!kitFolderId) return false;
  const { data } = await db
    .from("kit_folders")
    .select("kind")
    .eq("id", kitFolderId)
    .single();
  return data?.kind === "sermon_series";
}

export async function createKit(input: {
  name: string;
  description: string;
  kitFolderId?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name required" };
  const slug = slugify(name);
  if (!slug) return { ok: false, error: "Name must contain letters or numbers" };

  const db = await createClient();
  const { data: space } = await db.from("spaces").select("id").limit(1).single();
  if (!space) return { ok: false, error: "No space configured" };

  // A date range only applies to kits inside the static Sermon Series folder.
  const sermonSeries = await isSermonSeriesFolder(db, input.kitFolderId);

  const { error } = await db.from("kits").insert({
    space_id: space.id,
    name,
    slug,
    description: input.description.trim() || null,
    kit_folder_id: input.kitFolderId ?? null,
    starts_on: sermonSeries ? normalizeDate(input.startsOn) : null,
    ends_on: sermonSeries ? normalizeDate(input.endsOn) : null,
  });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "A kit with that name already exists" : "Failed to create kit",
    };
  }

  revalidatePath("/kits");
  return { ok: true, slug };
}

export async function updateKit(input: {
  kitId: string;
  name: string;
  description: string;
  // Sent only by the edit dialog for sermon-series kits; undefined leaves the
  // stored range untouched.
  startsOn?: string | null;
  endsOn?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name required" };

  // Slug stays stable so existing URLs and share links keep working.
  const db = await createClient();
  const update: Partial<KitRow> = {
    name,
    description: input.description.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (input.startsOn !== undefined) update.starts_on = normalizeDate(input.startsOn);
  if (input.endsOn !== undefined) update.ends_on = normalizeDate(input.endsOn);

  const { error } = await db.from("kits").update(update).eq("id", input.kitId);
  if (error) return { ok: false, error: "Failed to update kit" };

  revalidatePath("/kits");
  return { ok: true };
}

export async function createKitSection(
  kitId: string,
  name: string
): Promise<{ ok: true; sectionId: string } | { ok: false; error: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Section name required" };

  const db = await createClient();
  const { count } = await db
    .from("kit_sections")
    .select("id", { count: "exact", head: true })
    .eq("kit_id", kitId);
  const { data: section, error } = await db
    .from("kit_sections")
    .insert({ kit_id: kitId, name: trimmed, sort_order: count ?? 0 })
    .select("id")
    .single();
  if (error || !section) return { ok: false, error: "Failed to create section" };

  revalidatePath("/kits");
  return { ok: true, sectionId: section.id };
}

export async function renameKitSection(
  sectionId: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Section name required" };

  const db = await createClient();
  const { error } = await db
    .from("kit_sections")
    .update({ name: trimmed })
    .eq("id", sectionId);
  if (error) return { ok: false, error: "Failed to rename section" };

  revalidatePath("/kits");
  return { ok: true };
}

export async function deleteKitSection(
  sectionId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };

  // Assets in the section become unsectioned (FK on delete set null).
  const db = await createClient();
  const { error } = await db.from("kit_sections").delete().eq("id", sectionId);
  if (error) return { ok: false, error: "Failed to delete section" };

  revalidatePath("/kits");
  return { ok: true };
}

const sectionOrderSchema = z.array(
  z.object({
    sectionId: z.string().uuid(),
    sortOrder: z.number().int().min(0).max(1000),
  })
).max(100);

/** Persist drag-reordered sections. */
export async function reorderKitSections(
  updates: Array<{ sectionId: string; sortOrder: number }>
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };

  const parsed = sectionOrderSchema.safeParse(updates);
  if (!parsed.success) return { ok: false, error: "Invalid order" };

  const db = await createClient();
  for (const update of parsed.data) {
    const { error } = await db
      .from("kit_sections")
      .update({ sort_order: update.sortOrder })
      .eq("id", update.sectionId);
    if (error) return { ok: false, error: "Failed to save section order" };
  }

  revalidatePath("/kits");
  return { ok: true };
}

const kitOrderSchema = z.array(
  z.object({
    kitId: z.string().uuid(),
    sortOrder: z.number().int().min(0).max(10000),
    // Present when a drag also moves the kit into a different folder
    // (null = kits root).
    kitFolderId: z.string().uuid().nullable().optional(),
  })
).max(500);

/** Persist a drag-reordered kit arrangement (and optional folder moves). */
export async function reorderKits(
  updates: Array<{
    kitId: string;
    sortOrder: number;
    kitFolderId?: string | null;
  }>
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };

  const parsed = kitOrderSchema.safeParse(updates);
  if (!parsed.success) return { ok: false, error: "Invalid order" };

  const db = await createClient();
  for (const update of parsed.data) {
    const { error } = await db
      .from("kits")
      .update({
        sort_order: update.sortOrder,
        ...(update.kitFolderId !== undefined
          ? { kit_folder_id: update.kitFolderId }
          : {}),
      })
      .eq("id", update.kitId);
    if (error) return { ok: false, error: "Failed to save order" };
  }

  revalidatePath("/kits");
  return { ok: true };
}

/**
 * Promote a section to its own kit: files (and a palette named after the
 * section, if any) move by reference into a new kit, optionally inside a
 * kit folder. The emptied section is deleted.
 */
export async function convertSectionToKit(
  sectionId: string,
  kitFolderId: string | null
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };

  const db = await createClient();
  const { data: section } = await db
    .from("kit_sections")
    .select("*")
    .eq("id", sectionId)
    .single();
  if (!section) return { ok: false, error: "Section not found" };

  const { data: sourceKit } = await db
    .from("kits")
    .select("id, space_id")
    .eq("id", section.kit_id)
    .single();
  if (!sourceKit) return { ok: false, error: "Kit not found" };

  // Unique slug: base name, then -2, -3… on collision.
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

  const { data: newKit, error: kitError } = await db
    .from("kits")
    .insert({
      space_id: sourceKit.space_id,
      name: section.name,
      slug,
      kit_folder_id: kitFolderId,
    })
    .select("id")
    .single();
  if (kitError || !newKit) return { ok: false, error: "Failed to create kit" };

  // Move the section's file assets.
  const { error: moveError } = await db
    .from("kit_assets")
    .update({ kit_id: newKit.id, section_id: null })
    .eq("section_id", sectionId);
  if (moveError) return { ok: false, error: "Failed to move files" };

  // A palette named after the section follows it.
  const { data: palette } = await db
    .from("palettes")
    .select("id")
    .eq("kit_id", sourceKit.id)
    .eq("name", section.name)
    .maybeSingle();
  if (palette) {
    await db.from("palettes").update({ kit_id: newKit.id }).eq("id", palette.id);
    await db
      .from("kit_assets")
      .update({ kit_id: newKit.id })
      .eq("asset_type", "palette")
      .eq("asset_id", palette.id);
  }

  await db.from("kit_sections").delete().eq("id", sectionId);

  revalidatePath("/kits");
  return { ok: true, slug };
}

const reorderSchema = z.array(
  z.object({
    kitAssetId: z.string().uuid(),
    sectionId: z.string().uuid().nullable(),
    sortOrder: z.number().int().min(0).max(10000),
  })
).max(500);

/** Persist a drag-and-drop arrangement: section membership + order. */
export async function reorderKitAssets(
  updates: Array<{ kitAssetId: string; sectionId: string | null; sortOrder: number }>
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };

  const parsed = reorderSchema.safeParse(updates);
  if (!parsed.success) return { ok: false, error: "Invalid arrangement" };

  const db = await createClient();
  for (const update of parsed.data) {
    const { error } = await db
      .from("kit_assets")
      .update({ section_id: update.sectionId, sort_order: update.sortOrder })
      .eq("id", update.kitAssetId);
    if (error) return { ok: false, error: "Failed to save arrangement" };
  }

  revalidatePath("/kits");
  return { ok: true };
}

export async function deleteKit(
  kitId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") {
    return { ok: false, error: "Only admins can delete kits" };
  }
  const db = await createClient();
  const { error } = await db.from("kits").delete().eq("id", kitId);
  if (error) return { ok: false, error: "Failed to delete kit" };
  revalidatePath("/kits");
  return { ok: true };
}

const paletteSchema = z.object({
  kitId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  colors: z
    .array(
      z.object({
        hex: z.string().regex(HEX_RE, "Invalid hex"),
        name: z.string().trim().max(80),
        role: z.string().trim().max(80),
      })
    )
    .min(1)
    .max(24),
});

export async function addPalette(
  input: z.infer<typeof paletteSchema>
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };

  const parsed = paletteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid palette" };
  }

  const db = await createClient();
  const { data: palette, error } = await db
    .from("palettes")
    .insert({
      kit_id: parsed.data.kitId,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .select("id")
    .single();
  if (error || !palette) return { ok: false, error: "Failed to create palette" };

  const colorRows = parsed.data.colors.map((color, index) => ({
    palette_id: palette.id,
    hex: color.hex.startsWith("#") ? color.hex.toUpperCase() : `#${color.hex.toUpperCase()}`,
    name: color.name || null,
    role: color.role || null,
    sort_order: index,
  }));
  const { error: colorsError } = await db.from("colors").insert(colorRows);
  if (colorsError) return { ok: false, error: "Failed to save colors" };

  const { error: assetError } = await db.from("kit_assets").insert({
    kit_id: parsed.data.kitId,
    asset_type: "palette",
    asset_id: palette.id,
  });
  if (assetError) return { ok: false, error: "Failed to attach palette to kit" };

  revalidatePath("/kits");
  return { ok: true };
}

/**
 * Suggest a probable palette from the kit's source file (e.g. its master .ai).
 * Read-only — returns swatches for the editor to review and save via
 * addPalette; nothing is written here.
 */
export async function suggestPaletteFromSource(
  kitId: string
): Promise<
  | { ok: true; colors: SuggestedColor[]; named: boolean }
  | { ok: false; error: string }
> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };

  const db = await createClient();
  const { data: kit } = await db
    .from("kits")
    .select("source_file_id")
    .eq("id", kitId)
    .single();
  if (!kit?.source_file_id) {
    return { ok: false, error: "Upload a source file first" };
  }

  // Don't run if the kit already has a palette — extraction is for kits that
  // have none yet.
  const { count: paletteCount } = await db
    .from("palettes")
    .select("id", { count: "exact", head: true })
    .eq("kit_id", kitId);
  if (paletteCount && paletteCount > 0) {
    return { ok: false, error: "This kit already has a palette" };
  }

  const { data: file } = await db
    .from("files")
    .select("s3_bucket, s3_key, mime_type, original_filename")
    .eq("id", kit.source_file_id)
    .single();
  if (!file) return { ok: false, error: "Source file not found" };

  try {
    const buffer = await getObjectBuffer(file.s3_bucket, file.s3_key);
    const result = await extractPaletteSuggestion(
      buffer,
      file.mime_type,
      file.original_filename
    );
    if (result.colors.length === 0) {
      return { ok: false, error: "Couldn't detect distinct colors in this file" };
    }
    return { ok: true, colors: result.colors, named: result.named };
  } catch {
    return { ok: false, error: "Couldn't read colors from this file" };
  }
}

export async function deletePalette(
  paletteId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };
  const db = await createClient();
  await db
    .from("kit_assets")
    .delete()
    .eq("asset_type", "palette")
    .eq("asset_id", paletteId);
  const { error } = await db.from("palettes").delete().eq("id", paletteId);
  if (error) return { ok: false, error: "Failed to delete palette" };
  revalidatePath("/kits");
  return { ok: true };
}

const fontSchema = z.object({
  kitId: z.string().uuid(),
  family: z.string().trim().min(1).max(120),
  foundry: z.string().trim().max(120),
  licenseNote: z.string().trim().max(500),
  source: z.enum(["upload", "google", "adobe"]).default("upload"),
  // Google: family name. Adobe: web project id from fonts.adobe.com.
  externalRef: z.string().trim().max(200).default(""),
});

export async function addFont(
  input: z.input<typeof fontSchema>
): Promise<{ ok: true; fontId: string } | { ok: false; error: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };

  const parsed = fontSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid font details" };
  if (parsed.data.source !== "upload" && !parsed.data.externalRef) {
    return { ok: false, error: "Missing font reference" };
  }

  const db = await createClient();
  const { data: font, error } = await db
    .from("fonts")
    .insert({
      kit_id: parsed.data.kitId,
      family: parsed.data.family,
      foundry: parsed.data.foundry || null,
      license_note: parsed.data.licenseNote || null,
      source: parsed.data.source,
      external_ref: parsed.data.externalRef || null,
    })
    .select("id")
    .single();
  if (error || !font) return { ok: false, error: "Failed to add font" };

  const { error: assetError } = await db.from("kit_assets").insert({
    kit_id: parsed.data.kitId,
    asset_type: "font",
    asset_id: font.id,
  });
  if (assetError) return { ok: false, error: "Failed to attach font to kit" };

  revalidatePath("/kits");
  return { ok: true, fontId: font.id };
}

export async function deleteFont(
  fontId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };
  const db = await createClient();
  await db
    .from("kit_assets")
    .delete()
    .eq("asset_type", "font")
    .eq("asset_id", fontId);
  const { error } = await db.from("fonts").delete().eq("id", fontId);
  if (error) return { ok: false, error: "Failed to delete font" };
  revalidatePath("/kits");
  return { ok: true };
}

export async function removeKitFile(
  kitAssetId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };
  const db = await createClient();
  const { error } = await db.from("kit_assets").delete().eq("id", kitAssetId);
  if (error) return { ok: false, error: "Failed to remove file" };
  revalidatePath("/kits");
  return { ok: true };
}
