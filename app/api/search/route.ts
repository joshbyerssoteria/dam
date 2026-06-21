import { NextResponse } from "next/server";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { embedText } from "@/lib/embeddings";
import {
  applyRelevanceCutoff,
  embeddingToVectorLiteral,
  FOLDER_MATCH_RATIO,
  queryToTags,
  scoreFolder,
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

export interface SearchFolderItem {
  folderId: string;
  name: string;
  description: string | null;
  photoCount: number;
  coverFileId: string | null;
  score: number;
}

const FOLDER_RESULT_LIMIT = 12;

/**
 * Find albums whose name or description matches the query (SPEC.md → Search):
 * when someone searches "father's day" we want the past event folders to
 * surface first, each clickable as a whole album, before individual photo
 * matches. Name matches outrank description matches.
 */
async function searchFolders(
  db: Awaited<ReturnType<typeof createClient>>,
  tokens: string[]
): Promise<SearchFolderItem[]> {
  if (tokens.length === 0) return [];

  // Pull candidates matching any token in name or description, then require a
  // quorum of tokens in JS. Tokens are sanitized to [a-z0-9-] by queryToTags,
  // so they are safe to interpolate into ilike patterns.
  const orFilter = tokens
    .flatMap((token) => [`name.ilike.%${token}%`, `description.ilike.%${token}%`])
    .join(",");
  const { data: candidates, error } = await db
    .from("folders")
    .select("id, name, description, cover_photo_id")
    .or(orFilter)
    .limit(50);
  if (error || !candidates) return [];

  const scored = candidates
    .map((folder) => ({
      folder,
      ...scoreFolder(folder.name, folder.description, tokens),
    }))
    .filter((entry) => entry.coverage >= FOLDER_MATCH_RATIO)
    .sort((a, b) => b.score - a.score)
    .slice(0, FOLDER_RESULT_LIMIT);

  return Promise.all(
    scored.map(async ({ folder, score }) => {
      const [{ count }, coverFileId] = await Promise.all([
        db
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("folder_id", folder.id),
        folderCoverFileId(db, folder.id, folder.cover_photo_id),
      ]);
      return {
        folderId: folder.id,
        name: folder.name,
        description: folder.description,
        photoCount: count ?? 0,
        coverFileId,
        score,
      };
    })
  );
}

/** Resolve a thumbnail file for an album: its cover photo, else any photo. */
async function folderCoverFileId(
  db: Awaited<ReturnType<typeof createClient>>,
  folderId: string,
  coverPhotoId: string | null
): Promise<string | null> {
  if (coverPhotoId) {
    const { data } = await db
      .from("photos")
      .select("file_id")
      .eq("id", coverPhotoId)
      .maybeSingle();
    if (data?.file_id) return data.file_id;
  }
  const { data } = await db
    .from("photos")
    .select("file_id")
    .eq("folder_id", folderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.file_id ?? null;
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
    return NextResponse.json({ results: [], folders: [], mode: "none" });
  }

  const [embedding, tags] = await Promise.all([
    embedText(query).catch(() => null),
    Promise.resolve(queryToTags(query)),
  ]);

  const db = await createClient();
  const [{ data: matches, error }, folders] = await Promise.all([
    db.rpc("search_photos", {
      query_embedding: embedding ? embeddingToVectorLiteral(embedding) : null,
      query_tags: tags,
      semantic_weight: embedding ? SEMANTIC_WEIGHT : 0,
      match_limit: 60,
    }),
    searchFolders(db, tags),
  ]);
  if (error) {
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }

  // `search_photos` ranks candidates by score but admits weak matches; keep
  // only the relevant cluster near the top hit (SPEC.md → Search).
  const matchList = applyRelevanceCutoff(matches ?? []);
  if (matchList.length === 0) {
    return NextResponse.json({
      results: [],
      folders,
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
    folders,
    mode: embedding ? "hybrid" : "keyword",
  });
}
