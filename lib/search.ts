/**
 * Hybrid search helpers. The heavy lifting (vector + keyword scoring) happens
 * in the `search_photos` Postgres function; this module prepares inputs.
 */

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "at", "be", "by", "for", "from", "in", "is",
  "it", "of", "on", "or", "the", "to", "with", "photos", "photo", "pictures",
  "picture", "images", "image", "shots", "shot",
]);

/** Tokenize a free-text query into keyword candidates for ai_tags matching. */
export function queryToTags(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    ),
  ];
}

export const SEMANTIC_WEIGHT = 0.7;

/** Serialize an embedding for the pgvector wire format. */
export function embeddingToVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
