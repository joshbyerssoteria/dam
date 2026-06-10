import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  FolderRow,
  KitRow,
  ShareLinkRow,
} from "@/lib/database.types";
import { isTokenLive } from "@/lib/tokens";

export type ResolvedShare =
  | { share: ShareLinkRow; targetType: "kit"; kit: KitRow }
  | { share: ShareLinkRow; targetType: "folder"; folder: FolderRow };

/** Look up a live share link and its target. Null = unknown, expired, or orphaned. */
export async function resolveShare(
  db: SupabaseClient<Database>,
  token: string
): Promise<ResolvedShare | null> {
  const { data: share } = await db
    .from("share_links")
    .select("*")
    .eq("token", token)
    .single();
  if (!share || !isTokenLive(share.expires_at)) return null;

  if (share.target_type === "kit") {
    const { data: kit } = await db
      .from("kits")
      .select("*")
      .eq("id", share.target_id)
      .single();
    return kit ? { share, targetType: "kit", kit } : null;
  }

  const { data: folder } = await db
    .from("folders")
    .select("*")
    .eq("id", share.target_id)
    .single();
  return folder ? { share, targetType: "folder", folder } : null;
}

export function shareUnlockCookieName(token: string): string {
  return `share_unlock_${token}`;
}

/**
 * Unforgeable unlock proof: derived from the stored bcrypt hash, so it cannot
 * be fabricated without knowing the password, and revoking/regenerating the
 * password invalidates existing cookies.
 */
export function shareUnlockCookieValue(share: ShareLinkRow): string {
  return createHash("sha256")
    .update(`${share.token}:${share.password_hash ?? ""}`)
    .digest("hex");
}

export function isShareUnlocked(
  share: ShareLinkRow,
  cookieValue: string | undefined
): boolean {
  if (!share.password_hash) return true;
  return cookieValue === shareUnlockCookieValue(share);
}

/** All folder ids in the subtree rooted at rootId (including the root). */
export async function collectFolderSubtreeIds(
  db: SupabaseClient<Database>,
  rootId: string
): Promise<string[]> {
  const { data: allFolders } = await db
    .from("folders")
    .select("id, parent_id");
  const folderList = allFolders ?? [];

  const childrenByParent = new Map<string, string[]>();
  for (const folder of folderList) {
    if (!folder.parent_id) continue;
    const siblings = childrenByParent.get(folder.parent_id) ?? [];
    siblings.push(folder.id);
    childrenByParent.set(folder.parent_id, siblings);
  }

  const result: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    queue.push(...(childrenByParent.get(current) ?? []));
  }
  return result;
}

/** File ids reachable through a share — the only files its routes may serve. */
export async function collectShareFileIds(
  db: SupabaseClient<Database>,
  resolved: ResolvedShare
): Promise<Set<string>> {
  const fileIds = new Set<string>();

  if (resolved.targetType === "folder") {
    const folderIds = await collectFolderSubtreeIds(db, resolved.folder.id);
    const { data: photos } = await db
      .from("photos")
      .select("file_id")
      .in("folder_id", folderIds);
    for (const photo of photos ?? []) fileIds.add(photo.file_id);
    return fileIds;
  }

  const { data: assets } = await db
    .from("kit_assets")
    .select("asset_type, asset_id")
    .eq("kit_id", resolved.kit.id);
  for (const asset of assets ?? []) {
    if (asset.asset_type === "file") fileIds.add(asset.asset_id);
  }

  const { data: fonts } = await db
    .from("fonts")
    .select("id")
    .eq("kit_id", resolved.kit.id);
  const fontIds = (fonts ?? []).map((font) => font.id);
  if (fontIds.length > 0) {
    const { data: fontFiles } = await db
      .from("font_files")
      .select("file_id")
      .in("font_id", fontIds);
    for (const fontFile of fontFiles ?? []) fileIds.add(fontFile.file_id);
  }

  if (resolved.kit.cover_image_id) fileIds.add(resolved.kit.cover_image_id);
  if (resolved.kit.source_file_id) fileIds.add(resolved.kit.source_file_id);
  return fileIds;
}
