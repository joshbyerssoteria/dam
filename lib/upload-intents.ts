import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FileRow, UploadTokenRow } from "@/lib/database.types";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTokenLive } from "@/lib/tokens";
import { isImageMime } from "@/lib/upload";
import { inngest } from "@/lib/inngest/client";
import { taggingConfigured } from "@/lib/tagging";

export const uploadIntentSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("photo"), folderId: z.string().uuid() }),
  z.object({ intent: z.literal("portal-photo"), uploadToken: z.string().min(8) }),
  z.object({
    intent: z.literal("kit-file"),
    kitId: z.string().uuid(),
    sectionId: z.string().uuid().optional(),
  }),
  z.object({ intent: z.literal("kit-cover"), kitId: z.string().uuid() }),
  z.object({ intent: z.literal("kit-source"), kitId: z.string().uuid() }),
  z.object({
    intent: z.literal("font-file"),
    fontId: z.string().uuid(),
    weight: z.coerce.number().int().min(1).max(1000).optional(),
    style: z.string().max(40).optional(),
  }),
]);

export type UploadIntent = z.infer<typeof uploadIntentSchema>;

export function keyPrefixForIntent(intent: UploadIntent): string {
  switch (intent.intent) {
    case "photo":
    case "portal-photo":
      return "photos";
    case "kit-file":
      return "kit-files";
    case "kit-cover":
      return "kit-covers";
    case "kit-source":
      return "kit-source";
    case "font-file":
      return "fonts";
  }
}

export type AuthorizedUpload =
  | {
      ok: true;
      db: SupabaseClient<Database>;
      uploadedBy: string | null;
      portalToken: UploadTokenRow | null;
    }
  | { ok: false; status: number; error: string };

/**
 * Authorize an upload intent: portal uploads validate the upload token
 * (admin client); everything else requires an editor/admin session.
 * `mimeType` is checked for photo intents (images only).
 */
export async function authorizeUploadIntent(
  intent: UploadIntent,
  mimeType: string
): Promise<AuthorizedUpload> {
  if (intent.intent === "portal-photo") {
    const admin = createAdminClient();
    const { data: token } = await admin
      .from("upload_tokens")
      .select("*")
      .eq("token", intent.uploadToken)
      .single();

    if (!token || !isTokenLive(token.expires_at)) {
      return { ok: false, status: 403, error: "Upload link is no longer valid" };
    }
    if (token.max_files !== null && token.used_count >= token.max_files) {
      return { ok: false, status: 403, error: "Upload limit reached for this link" };
    }
    if (!isImageMime(mimeType)) {
      return { ok: false, status: 415, error: "Only image uploads are accepted" };
    }
    return { ok: true, db: admin, uploadedBy: null, portalToken: token };
  }

  const session = await getSessionProfile();
  if (!session) {
    return { ok: false, status: 401, error: "Not signed in" };
  }
  if (session.profile.role === "viewer") {
    return { ok: false, status: 403, error: "Viewers cannot upload" };
  }
  if (
    (intent.intent === "photo" || intent.intent === "kit-cover") &&
    !isImageMime(mimeType)
  ) {
    return {
      ok: false,
      status: 415,
      error:
        intent.intent === "photo"
          ? "Only image uploads are accepted in the photo library"
          : "Cover must be an image",
    };
  }

  const db = await createClient();
  return { ok: true, db, uploadedBy: session.userId, portalToken: null };
}

async function triggerTagging(photoId: string) {
  if (!taggingConfigured()) return;
  try {
    await inngest.send({ name: "photo/uploaded", data: { photoId } });
  } catch (error) {
    // Best-effort — never fail an upload because the job queue is down.
    console.error("Failed to enqueue tagging job", error);
  }
}

/**
 * Create the domain rows for a stored file (photo, kit asset, cover, font
 * file), update portal token bookkeeping, and kick off tagging.
 */
export async function finalizeUpload(
  auth: Extract<AuthorizedUpload, { ok: true }>,
  intent: UploadIntent,
  file: FileRow
): Promise<{ ok: true; photoId?: string } | { ok: false; status: number; error: string }> {
  const { db, uploadedBy, portalToken } = auth;

  if (intent.intent === "portal-photo") {
    const { data: photo, error } = await db
      .from("photos")
      .insert({
        folder_id: portalToken!.target_folder_id,
        file_id: file.id,
        photographer_name: portalToken!.photographer_name,
      })
      .select("id")
      .single();
    if (error || !photo) {
      return { ok: false, status: 500, error: "Failed to save photo" };
    }
    await db
      .from("upload_tokens")
      .update({ used_count: portalToken!.used_count + 1 })
      .eq("id", portalToken!.id);
    await db
      .from("upload_log")
      .insert({ upload_token: portalToken!.token, file_id: file.id });
    await triggerTagging(photo.id);
    return { ok: true, photoId: photo.id };
  }

  if (intent.intent === "photo") {
    const { data: photo, error } = await db
      .from("photos")
      .insert({
        folder_id: intent.folderId,
        file_id: file.id,
        uploaded_by: uploadedBy,
      })
      .select("id")
      .single();
    if (error || !photo) {
      return { ok: false, status: 500, error: "Failed to save photo" };
    }
    await triggerTagging(photo.id);
    return { ok: true, photoId: photo.id };
  }

  if (intent.intent === "kit-file") {
    const { error } = await db.from("kit_assets").insert({
      kit_id: intent.kitId,
      asset_type: "file",
      asset_id: file.id,
      section_id: intent.sectionId ?? null,
    });
    if (error) {
      return { ok: false, status: 500, error: "Failed to add file to kit" };
    }
    return { ok: true };
  }

  if (intent.intent === "kit-cover") {
    const { error } = await db
      .from("kits")
      .update({ cover_image_id: file.id })
      .eq("id", intent.kitId);
    if (error) {
      return { ok: false, status: 500, error: "Failed to set cover" };
    }
    return { ok: true };
  }

  if (intent.intent === "kit-source") {
    const { error } = await db
      .from("kits")
      .update({ source_file_id: file.id })
      .eq("id", intent.kitId);
    if (error) {
      return { ok: false, status: 500, error: "Failed to set source file" };
    }
    return { ok: true };
  }

  // font-file
  const { error } = await db.from("font_files").insert({
    font_id: intent.fontId,
    file_id: file.id,
    weight: intent.weight ?? null,
    style: intent.style ?? null,
  });
  if (error) {
    return { ok: false, status: 500, error: "Failed to add font file" };
  }
  return { ok: true };
}
