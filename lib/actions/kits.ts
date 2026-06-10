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
});

export async function addFont(
  input: z.infer<typeof fontSchema>
): Promise<{ ok: true; fontId: string } | { ok: false; error: string }> {
  const session = await requireEditor();
  if (!session) return { ok: false, error: "Not allowed" };

  const parsed = fontSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid font details" };

  const db = await createClient();
  const { data: font, error } = await db
    .from("fonts")
    .insert({
      kit_id: parsed.data.kitId,
      family: parsed.data.family,
      foundry: parsed.data.foundry || null,
      license_note: parsed.data.licenseNote || null,
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
