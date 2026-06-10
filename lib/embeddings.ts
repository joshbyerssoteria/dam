import OpenAI from "openai";

export function embeddingsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Embed text with text-embedding-3-small (1536 dimensions).
 * Returns null when OPENAI_API_KEY is not configured so callers can fall
 * back to keyword-only behavior.
 */
export async function embedText(text: string): Promise<number[] | null> {
  if (!embeddingsConfigured()) return null;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0]?.embedding ?? null;
}
