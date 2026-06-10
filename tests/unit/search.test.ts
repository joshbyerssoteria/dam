import { describe, expect, it } from "vitest";
import {
  embeddingToVectorLiteral,
  queryToTags,
  SEMANTIC_WEIGHT,
} from "@/lib/search";

describe("queryToTags", () => {
  it("lowercases, dedupes, and strips stop words", () => {
    expect(queryToTags("Photos of the Worship and worship")).toEqual([
      "worship",
    ]);
  });

  it("keeps meaningful words including hyphenated", () => {
    expect(queryToTags("hands raised in worship")).toEqual([
      "hands",
      "raised",
      "worship",
    ]);
  });

  it("drops single-character noise and punctuation", () => {
    expect(queryToTags("a b, baptism!")).toEqual(["baptism"]);
  });

  it("returns empty for stop-words-only queries", () => {
    expect(queryToTags("photos of the")).toEqual([]);
  });
});

describe("embeddingToVectorLiteral", () => {
  it("serializes to pgvector format", () => {
    expect(embeddingToVectorLiteral([0.1, -0.2, 1])).toBe("[0.1,-0.2,1]");
  });
});

describe("SEMANTIC_WEIGHT", () => {
  it("matches the spec default of 70/30", () => {
    expect(SEMANTIC_WEIGHT).toBe(0.7);
  });
});
