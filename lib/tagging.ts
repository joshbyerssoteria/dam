import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const EVENT_TYPES = [
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

const tagResultSchema = z.object({
  tags: z.array(z.string()).min(1).max(20),
  scene: z.string(),
  caption: z.string(),
  event_type: z.enum(EVENT_TYPES).catch("other"),
});

export type TagResult = z.infer<typeof tagResultSchema>;

export function taggingConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Prompt is specified verbatim in SPEC.md — keep in sync.
const TAGGING_PROMPT = `You are analyzing a photograph from a church event archive for a Digital Asset Management system. Return ONLY valid JSON with these fields:

{
  "tags": ["array of 5-15 specific descriptive tags covering people, actions, settings, objects, mood"],
  "scene": "one-sentence factual description of what is happening",
  "caption": "one descriptive sentence optimized for semantic search — include people, action, setting, emotional tone",
  "event_type": "one of: worship_service, baptism, kids_ministry, students, men, women, conference, fellowship, outdoor, other"
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
