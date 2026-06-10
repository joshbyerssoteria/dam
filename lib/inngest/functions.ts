import sharp from "sharp";
import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getObjectBuffer } from "@/lib/storage";
import { tagPhoto, taggingConfigured, toSupportedMediaType } from "@/lib/tagging";
import { embedText, embeddingsConfigured } from "@/lib/embeddings";
import { embeddingToVectorLiteral } from "@/lib/search";

/**
 * AI tagging pipeline (SPEC.md → Implementation Notes):
 * 1. Fetch the original, downscale to a small variant with sharp
 * 2. Claude vision → tags, scene, caption, event_type
 * 3. Embed the caption with text-embedding-3-small
 * 4. Store everything on the photo row
 *
 * Skips gracefully (no-op) when AI keys are not configured, so uploads work
 * in a bare development environment.
 */
export const tagUploadedPhoto = inngest.createFunction(
  { id: "tag-uploaded-photo", retries: 3 },
  { event: "photo/uploaded" },
  async ({ event, step }) => {
    if (!taggingConfigured()) {
      return { skipped: true, reason: "ANTHROPIC_API_KEY not configured" };
    }

    const tagResult = await step.run("tag-with-claude-vision", async () => {
      const supabase = createAdminClient();
      const { data: photo, error } = await supabase
        .from("photos")
        .select("id, file_id")
        .eq("id", event.data.photoId)
        .single();
      if (error || !photo) throw new Error(`Photo not found: ${event.data.photoId}`);

      const { data: file, error: fileError } = await supabase
        .from("files")
        .select("*")
        .eq("id", photo.file_id)
        .single();
      if (fileError || !file) throw new Error(`File not found: ${photo.file_id}`);

      const original = await getObjectBuffer(file.s3_bucket, file.s3_key);
      const variant = await sharp(original)
        .rotate() // respect EXIF orientation
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const mediaType = toSupportedMediaType("image/jpeg");
      if (!mediaType) throw new Error("unreachable");

      const result = await tagPhoto(variant.toString("base64"), mediaType);
      if (!result) throw new Error("Tagging unexpectedly unconfigured");
      return result;
    });

    const embedding = await step.run("embed-caption", async () => {
      if (!embeddingsConfigured()) return null;
      return embedText(tagResult.caption);
    });

    await step.run("store-results", async () => {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from("photos")
        .update({
          ai_tags: tagResult.tags.map((tag) => tag.toLowerCase()),
          ai_caption: tagResult.caption,
          ai_scene: tagResult.scene,
          event_type: tagResult.event_type,
          ...(embedding
            ? { embedding: embeddingToVectorLiteral(embedding) }
            : {}),
        })
        .eq("id", event.data.photoId);
      if (error) throw new Error(`Failed to store tags: ${error.message}`);
    });

    return { skipped: false, tags: tagResult.tags.length };
  }
);

export const functions = [tagUploadedPhoto];
