import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SearchClient } from "@/components/search-client";
import { embeddingsConfigured } from "@/lib/embeddings";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const semantic = embeddingsConfigured();

  return (
    <div>
      <PageHeader
        title="Search"
        description={
          semantic
            ? "Search the photo archive by keyword or meaning — “hands raised in worship” works."
            : "Search the photo archive by keyword."
        }
      />
      <div className="p-8">
        <SearchClient initialQuery={q ?? ""} />
      </div>
    </div>
  );
}
