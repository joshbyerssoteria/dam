import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTokenLive } from "@/lib/tokens";
import { isImageMime, MAX_UPLOAD_BYTES, storeFile } from "@/lib/upload";
import { inngest } from "@/lib/inngest/client";
import { taggingConfigured } from "@/lib/tagging";

export const runtime = "nodejs";
export const maxDuration = 60;

const intentSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("photo"), folderId: z.string().uuid() }),
  z.object({ intent: z.literal("portal-photo"), uploadToken: z.string().min(8) }),
  z.object({ intent: z.literal("kit-file"), kitId: z.string().uuid() }),
  z.object({ intent: z.literal("kit-cover"), kitId: z.string().uuid() }),
  z.object({
    intent: z.literal("font-file"),
    fontId: z.string().uuid(),
    weight: z.coerce.number().int().min(1).max(1000).optional(),
    style: z.string().max(40).optional(),
  }),
]);

async function triggerTagging(photoId: string) {
  if (!taggingConfigured()) return;
  try {
    await inngest.send({ name: "photo/uploaded", data: { photoId } });
  } catch (error) {
    // Tagging is best-effort — never fail an upload because the job
    // queue is unreachable.
    console.error("Failed to enqueue tagging job", error);
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 413 });
  }

  const parsed = intentSchema.safeParse(
    Object.fromEntries(
      [...formData.entries()].filter(([, value]) => typeof value === "string")
    )
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }
  const intent = parsed.data;

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  // ---------------------------------------------------------------- portal
  if (intent.intent === "portal-photo") {
    const admin = createAdminClient();
    const { data: token } = await admin
      .from("upload_tokens")
      .select("*")
      .eq("token", intent.uploadToken)
      .single();

    if (!token || !isTokenLive(token.expires_at)) {
      return NextResponse.json({ error: "Upload link is no longer valid" }, { status: 403 });
    }
    if (token.max_files !== null && token.used_count >= token.max_files) {
      return NextResponse.json({ error: "Upload limit reached for this link" }, { status: 403 });
    }
    if (!isImageMime(mimeType)) {
      return NextResponse.json({ error: "Only image uploads are accepted" }, { status: 415 });
    }

    const fileRow = await storeFile(admin, {
      buffer,
      filename: file.name,
      mimeType,
      keyPrefix: "photos",
      uploadedBy: null,
    });

    const { data: photo, error: photoError } = await admin
      .from("photos")
      .insert({
        folder_id: token.target_folder_id,
        file_id: fileRow.id,
        photographer_name: token.photographer_name,
      })
      .select("id")
      .single();
    if (photoError || !photo) {
      return NextResponse.json({ error: "Failed to save photo" }, { status: 500 });
    }

    await admin
      .from("upload_tokens")
      .update({ used_count: token.used_count + 1 })
      .eq("id", token.id);
    await admin
      .from("upload_log")
      .insert({ upload_token: token.token, file_id: fileRow.id });

    await triggerTagging(photo.id);
    return NextResponse.json({ ok: true, photoId: photo.id });
  }

  // ------------------------------------------------------- authenticated
  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (session.profile.role === "viewer") {
    return NextResponse.json({ error: "Viewers cannot upload" }, { status: 403 });
  }

  const db = await createClient();

  if (intent.intent === "photo") {
    if (!isImageMime(mimeType)) {
      return NextResponse.json({ error: "Only image uploads are accepted in the photo library" }, { status: 415 });
    }
    const fileRow = await storeFile(db, {
      buffer,
      filename: file.name,
      mimeType,
      keyPrefix: "photos",
      uploadedBy: session.userId,
    });
    const { data: photo, error } = await db
      .from("photos")
      .insert({
        folder_id: intent.folderId,
        file_id: fileRow.id,
        uploaded_by: session.userId,
      })
      .select("id")
      .single();
    if (error || !photo) {
      return NextResponse.json({ error: "Failed to save photo" }, { status: 500 });
    }
    await triggerTagging(photo.id);
    return NextResponse.json({ ok: true, photoId: photo.id });
  }

  if (intent.intent === "kit-file") {
    const fileRow = await storeFile(db, {
      buffer,
      filename: file.name,
      mimeType,
      keyPrefix: "kit-files",
      uploadedBy: session.userId,
    });
    const { error } = await db.from("kit_assets").insert({
      kit_id: intent.kitId,
      asset_type: "file",
      asset_id: fileRow.id,
    });
    if (error) {
      return NextResponse.json({ error: "Failed to add file to kit" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, fileId: fileRow.id });
  }

  if (intent.intent === "kit-cover") {
    if (!isImageMime(mimeType)) {
      return NextResponse.json({ error: "Cover must be an image" }, { status: 415 });
    }
    const fileRow = await storeFile(db, {
      buffer,
      filename: file.name,
      mimeType,
      keyPrefix: "kit-covers",
      uploadedBy: session.userId,
    });
    const { error } = await db
      .from("kits")
      .update({ cover_image_id: fileRow.id })
      .eq("id", intent.kitId);
    if (error) {
      return NextResponse.json({ error: "Failed to set cover" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, fileId: fileRow.id });
  }

  // font-file
  const fileRow = await storeFile(db, {
    buffer,
    filename: file.name,
    mimeType,
    keyPrefix: "fonts",
    uploadedBy: session.userId,
  });
  const { error } = await db.from("font_files").insert({
    font_id: intent.fontId,
    file_id: fileRow.id,
    weight: intent.weight ?? null,
    style: intent.style ?? null,
  });
  if (error) {
    return NextResponse.json({ error: "Failed to add font file" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, fileId: fileRow.id });
}
