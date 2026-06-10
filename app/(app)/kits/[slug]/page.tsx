import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { loadKitContent } from "@/lib/kit-data";
import { AddFontDialog } from "@/components/add-font-dialog";
import { AddPaletteDialog } from "@/components/add-palette-dialog";
import { KitContent } from "@/components/kit-content";
import { KitFileUpload } from "@/components/kit-file-upload";
import { PageHeader } from "@/components/page-header";
import { ShareDialog } from "@/components/share-dialog";

export const metadata: Metadata = { title: "Kit" };

export default async function KitDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSessionProfile();
  const db = await createClient();

  const { data: kit } = await db
    .from("kits")
    .select("*")
    .eq("slug", slug)
    .single();
  if (!kit) notFound();

  const data = await loadKitContent(db, kit);
  const canEdit = session !== null && session.profile.role !== "viewer";

  return (
    <div>
      <PageHeader
        title={kit.name}
        description={kit.description ?? undefined}
      >
        {canEdit ? (
          <>
            <KitFileUpload kitId={kit.id} />
            <AddPaletteDialog kitId={kit.id} />
            <AddFontDialog kitId={kit.id} />
            <ShareDialog
              targetType="kit"
              targetId={kit.id}
              targetName={kit.name}
            />
          </>
        ) : null}
      </PageHeader>

      <div className="p-8">
        <KitContent data={data} canEdit={canEdit} />
      </div>
    </div>
  );
}
