import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SearchClient } from "@/components/search-client";
import { embeddingsConfigured } from "@/lib/embeddings";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  const semantic = embeddingsConfigured();

  return (
    <div>
      <PageHeader
        title="Search"
        description={
          semantic
            ? "Search the photo archive by keyword or meaning — “hands raised in worship” works."
            : "Keyword search across AI tags. Add OPENAI_API_KEY to enable semantic search."
        }
      />
      <div className="p-8">
        <SearchClient />
      </div>
    </div>
  );
}
