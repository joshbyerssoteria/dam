import type { Metadata } from "next";
import Link from "next/link";
import { Palette } from "lucide-react";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { NewKitDialog } from "@/components/new-kit-dialog";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Kits" };

export default async function KitsPage() {
  const session = await getSessionProfile();
  const db = await createClient();

  const { data: kits } = await db
    .from("kits")
    .select("id, slug, name, description, cover_image_id")
    .order("sort_order")
    .order("name");

  const canEdit = session !== null && session.profile.role !== "viewer";

  return (
    <div>
      <PageHeader
        title="Kits"
        description="Brand assets — logos, color palettes, fonts, and templates."
      >
        {canEdit ? <NewKitDialog /> : null}
      </PageHeader>

      <div className="p-8">
        {(kits ?? []).length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm text-muted-foreground">
              No kits yet.{" "}
              {canEdit ? "Create the first kit to organize brand assets." : ""}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(kits ?? []).map((kit) => (
              <Link
                key={kit.id}
                href={`/kits/${kit.slug}`}
                className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-muted-foreground/40"
              >
                <div className="flex aspect-[2/1] items-center justify-center bg-muted">
                  {kit.cover_image_id ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route */
                    <img
                      src={`/api/files/${kit.cover_image_id}?w=960`}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <Palette
                      className="size-8 text-muted-foreground"
                      strokeWidth={1.25}
                    />
                  )}
                </div>
                <div className="px-5 py-4">
                  <h2 className="text-sm font-medium">{kit.name}</h2>
                  {kit.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {kit.description}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
