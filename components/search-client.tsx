"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResponseItem } from "@/app/api/search/route";

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponseItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
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
        };
        setResults(body.results);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
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
        ) : results.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No matches. Photos gain tags a few seconds after upload — try
            different words, or check that tagging has run.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {results.map((result) => (
              <Link
                key={result.photoId}
                href={`/photos/${result.folderId}`}
                className="group relative aspect-square overflow-hidden bg-muted"
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
        )}
      </div>
    </div>
  );
}
