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

/**
 * Relative relevance cutoff applied after scoring. The Postgres function
 * returns up to `match_limit` candidates ranked by score, but admits anything
 * with even a weak match — so a query padded to the limit trails off into
 * loosely-related photos. We keep only results scoring within this fraction of
 * the top hit and drop the weaker tail. It adapts per query: a dense cluster
 * (e.g. "baptism") keeps everything, while a sparse query (e.g. "volunteers
 * serving coffee") trims its long tail instead of padding to the limit. The
 * top result is always kept (ratio ≤ 1), so a match never returns empty.
 */
export const RELEVANCE_RATIO = 0.85;

/** Drop results scoring below `RELEVANCE_RATIO` of the top (already sorted desc). */
export function applyRelevanceCutoff<T extends { score: number }>(
  ranked: T[]
): T[] {
  const top = ranked[0]?.score ?? 0;
  if (top <= 0) return ranked;
  const floor = top * RELEVANCE_RATIO;
  return ranked.filter((row) => row.score >= floor);
}

/** Serialize an embedding for the pgvector wire format. */
export function embeddingToVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
