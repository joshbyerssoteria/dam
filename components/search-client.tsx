"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Folder as FolderIcon, Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  SearchFolderItem,
  SearchResponseItem,
} from "@/app/api/search/route";

export function SearchClient({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResponseItem[] | null>(null);
  const [folders, setFolders] = useState<SearchFolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setFolders([]);
      setLoading(false);
      abortRef.current?.abort();
      window.history.replaceState(null, "", "/search");
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      // Keep the query in the URL so the browser back button restores these
      // results after the user clicks into an album or photo. replaceState
      // (not push) means typing doesn't stack history entries.
      window.history.replaceState(
        null,
        "",
        `/search?q=${encodeURIComponent(trimmed)}`
      );
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("search failed");
        const body = (await response.json()) as {
          results: SearchResponseItem[];
          folders?: SearchFolderItem[];
        };
        setResults(body.results);
        setFolders(body.folders ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
          setFolders([]);
        }
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <div className="relative max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="hands raised in worship…"
          className="pl-9"
          aria-label="Search photos"
        />
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square rounded-none" />
            ))}
          </div>
        ) : results === null ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Type to search the archive.
          </p>
        ) : results.length === 0 && folders.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No matches. Photos gain tags a few seconds after upload — try
            different words, or check that tagging has run.
          </p>
        ) : (
          <div className="space-y-10">
            {folders.length > 0 ? (
              <section>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Albums
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {folders.map((folder) => (
                    <Link
                      key={folder.folderId}
                      href={`/photos/${folder.folderId}`}
                      className="group overflow-hidden rounded-md border bg-card transition-colors hover:border-foreground/30"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-asset">
                        {folder.coverFileId ? (
                          // eslint-disable-next-line @next/next/no-img-element -- authenticated variant route
                          <img
                            src={`/api/files/${folder.coverFileId}?w=480`}
                            alt={folder.name}
                            loading="lazy"
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">
                            <FolderIcon
                              className="size-8 text-muted-foreground"
                              strokeWidth={1.5}
                            />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-medium">
                          {folder.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {folder.photoCount}{" "}
                          {folder.photoCount === 1 ? "photo" : "photos"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {results.length > 0 ? (
              <section>
                {folders.length > 0 ? (
                  <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Photos
                  </h2>
                ) : null}
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {results.map((result) => (
                    <Link
                      key={result.photoId}
                      href={`/photos/${result.folderId}?photo=${result.photoId}`}
                      className="group relative aspect-square overflow-hidden bg-asset"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route */}
                      <img
                        src={`/api/files/${result.fileId}?w=480`}
                        alt={result.caption ?? result.originalFilename}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                      {result.caption ? (
                        <span className="absolute inset-x-0 bottom-0 hidden bg-black/70 p-3 text-xs text-white group-hover:block">
                          {result.caption}
                          {result.eventType ? (
                            <Badge variant="secondary" className="ml-2">
                              {result.eventType.replace(/_/g, " ")}
                            </Badge>
                          ) : null}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
