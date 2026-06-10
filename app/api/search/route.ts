import { NextResponse } from "next/server";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { embedText } from "@/lib/embeddings";
import {
  embeddingToVectorLiteral,
  queryToTags,
  SEMANTIC_WEIGHT,
} from "@/lib/search";

export const runtime = "nodejs";

export interface SearchResponseItem {
  photoId: string;
  fileId: string;
  folderId: string;
  caption: string | null;
  tags: string[];
  eventType: string | null;
  score: number;
  originalFilename: string;
  fileSize: number;
  width: number | null;
  height: number | null;
}

/**
 * Hybrid search endpoint (SPEC.md → Search): semantic vector similarity
 * weighted 70/30 against keyword tag overlap. Falls back to keyword-only
 * when embeddings are not configured.
 */
export async function GET(request: Request) {
  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (!query) {
    return NextResponse.json({ results: [], mode: "none" });
  }

  const [embedding, tags] = await Promise.all([
    embedText(query).catch(() => null),
    Promise.resolve(queryToTags(query)),
  ]);

  const db = await createClient();
  const { data: matches, error } = await db.rpc("search_photos", {
    query_embedding: embedding ? embeddingToVectorLiteral(embedding) : null,
    query_tags: tags,
    semantic_weight: embedding ? SEMANTIC_WEIGHT : 0,
    match_limit: 60,
  });
  if (error) {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  const matchList = matches ?? [];
  if (matchList.length === 0) {
    return NextResponse.json({
      results: [],
      mode: embedding ? "hybrid" : "keyword",
    });
  }

  const photoIds = matchList.map((match) => match.photo_id);
  const { data: photos } = await db
    .from("photos")
    .select("*, files(*)")
    .in("id", photoIds);

  const scoreByPhotoId = new Map(
    matchList.map((match) => [match.photo_id, match.score])
  );
  const results: SearchResponseItem[] = (photos ?? [])
    .flatMap((photo) => {
      const file = photo.files as {
        id: string;
        original_filename: string;
        file_size: number;
        width: number | null;
        height: number | null;
      } | null;
      if (!file) return [];
      return [
        {
          photoId: photo.id,
          fileId: file.id,
          folderId: photo.folder_id,
          caption: photo.ai_caption,
          tags: photo.ai_tags,
          eventType: photo.event_type,
          score: scoreByPhotoId.get(photo.id) ?? 0,
          originalFilename: file.original_filename,
          fileSize: file.file_size,
          width: file.width,
          height: file.height,
        },
      ];
    })
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({
    results,
    mode: embedding ? "hybrid" : "keyword",
  });
}
