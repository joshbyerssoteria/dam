import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ColorRow,
  Database,
  FileRow,
  FontFileRow,
  FontRow,
  KitRow,
  PaletteRow,
} from "@/lib/database.types";

export interface KitContentData {
  kit: KitRow;
  files: Array<{ kitAssetId: string; file: FileRow }>;
  palettes: Array<{ palette: PaletteRow; colors: ColorRow[] }>;
  fonts: Array<{
    font: FontRow;
    files: Array<{ fontFile: FontFileRow; file: FileRow }>;
  }>;
}

/**
 * Assemble everything a kit page renders. Works with either the user-scoped
 * client (app) or the admin client (public share views).
 */
export async function loadKitContent(
  db: SupabaseClient<Database>,
  kit: KitRow
): Promise<KitContentData> {
  const { data: assets } = await db
    .from("kit_assets")
    .select("*")
    .eq("kit_id", kit.id)
    .order("sort_order")
    .order("created_at");
  const assetList = assets ?? [];

  const fileIds = assetList
    .filter((asset) => asset.asset_type === "file")
    .map((asset) => asset.asset_id);

  const [filesResult, palettesResult, fontsResult] = await Promise.all([
    fileIds.length > 0
      ? db.from("files").select("*").in("id", fileIds)
      : Promise.resolve({ data: [] as FileRow[] }),
    db.from("palettes").select("*").eq("kit_id", kit.id).order("sort_order").order("created_at"),
    db.from("fonts").select("*").eq("kit_id", kit.id).order("sort_order").order("created_at"),
  ]);

  const fileRows = filesResult.data ?? [];
  const fileById = new Map(fileRows.map((file) => [file.id, file]));
  const files = assetList
    .filter((asset) => asset.asset_type === "file")
    .flatMap((asset) => {
      const file = fileById.get(asset.asset_id);
      return file ? [{ kitAssetId: asset.id, file }] : [];
    });

  const paletteRows = palettesResult.data ?? [];
  const paletteIds = paletteRows.map((palette) => palette.id);
  const { data: colorRows } =
    paletteIds.length > 0
      ? await db
          .from("colors")
          .select("*")
          .in("palette_id", paletteIds)
          .order("sort_order")
      : { data: [] as ColorRow[] };
  const palettes = paletteRows.map((palette) => ({
    palette,
    colors: (colorRows ?? []).filter(
      (color) => color.palette_id === palette.id
    ),
  }));

  const fontRows = fontsResult.data ?? [];
  const fontIds = fontRows.map((font) => font.id);
  const { data: fontFileRows } =
    fontIds.length > 0
      ? await db.from("font_files").select("*").in("font_id", fontIds)
      : { data: [] as FontFileRow[] };
  const fontFileList = fontFileRows ?? [];
  const fontFileFileIds = fontFileList.map((fontFile) => fontFile.file_id);
  const { data: fontBlobRows } =
    fontFileFileIds.length > 0
      ? await db.from("files").select("*").in("id", fontFileFileIds)
      : { data: [] as FileRow[] };
  const fontBlobById = new Map(
    (fontBlobRows ?? []).map((file) => [file.id, file])
  );
  const fonts = fontRows.map((font) => ({
    font,
    files: fontFileList
      .filter((fontFile) => fontFile.font_id === font.id)
      .flatMap((fontFile) => {
        const file = fontBlobById.get(fontFile.file_id);
        return file ? [{ fontFile, file }] : [];
      }),
  }));

  return { kit, files, palettes, fonts };
}
