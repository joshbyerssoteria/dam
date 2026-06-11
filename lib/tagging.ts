import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const DEFAULT_EVENT_TYPES = [
  "worship_service",
  "baptism",
  "kids_ministry",
  "students",
  "men",
  "women",
  "conference",
  "fellowship",
  "outdoor",
  "other",
] as const;

/**
 * Event taxonomy used by the tagging prompt and photo filters. Per-deployment
 * override via NEXT_PUBLIC_EVENT_TYPES (comma-separated); "other" is always
 * present as the fallback bucket. Stored as plain text in the DB, so changing
 * the list never breaks existing rows.
 */
export const EVENT_TYPES: readonly string[] = (() => {
  const raw = process.env.NEXT_PUBLIC_EVENT_TYPES;
  if (!raw) return DEFAULT_EVENT_TYPES;
  const types = raw.split(",").map((type) => type.trim()).filter(Boolean);
  if (!types.includes("other")) types.push("other");
  return types;
})();

const tagResultSchema = z.object({
  tags: z.array(z.string()).min(1).max(20),
  scene: z.string(),
  caption: z.string(),
  event_type: z
    .string()
    .catch("other")
    .transform((value) => (EVENT_TYPES.includes(value) ? value : "other")),
});

export type TagResult = z.infer<typeof tagResultSchema>;

export function taggingConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Prompt is specified verbatim in SPEC.md — keep in sync. The event_type
// list is interpolated so per-deployment taxonomies flow into the prompt.
const TAGGING_PROMPT = `You are analyzing a photograph from a church event archive for a Digital Asset Management system. Return ONLY valid JSON with these fields:

{
  "tags": ["array of 5-15 specific descriptive tags covering people, actions, settings, objects, mood"],
  "scene": "one-sentence factual description of what is happening",
  "caption": "one descriptive sentence optimized for semantic search — include people, action, setting, emotional tone",
  "event_type": "one of: ${EVENT_TYPES.join(", ")}"
}`;

const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export function toSupportedMediaType(
  mimeType: string
): SupportedMediaType | null {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(mimeType)
    ? (mimeType as SupportedMediaType)
    : null;
}

/**
 * Tag a photo with Claude vision. Returns null when ANTHROPIC_API_KEY is not
 * configured. Throws on API or parse errors so the job layer can retry.
 */
export async function tagPhoto(
  imageBase64: string,
  mediaType: SupportedMediaType
): Promise<TagResult | null> {
  if (!taggingConfigured()) return null;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          { type: "text", text: TAGGING_PROMPT },
        ],
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  // Tolerate accidental code fences around the JSON.
  const raw = textBlock.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  return tagResultSchema.parse(JSON.parse(raw));
}
