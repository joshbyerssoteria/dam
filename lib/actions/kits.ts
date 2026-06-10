"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

async function requireEditor() {
  const session = await getSessionProfile();
  if (!session || session.profile.role === "viewer") return null;
  return session;
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

export async function createKit(input: {
  name: string;
  description: string;
  kitFolderId?: string | null;
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

  const { error } = await db.from("kits").insert({
    space_id: space.id,
    name,
    slug,
    description: input.description.trim() || null,
    kit_folder_id: input.kitFolderId ?? null,
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
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name required" };

  // Slug stays stable so existing URLs and share links keep working.
  const db = await createClient();
  const { error } = await db
    .from("kits")
    .update({
      name,
      description: input.description.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.kitId);
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
