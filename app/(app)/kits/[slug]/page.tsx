import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { loadKitContent } from "@/lib/kit-data";
import { AddFontDialog } from "@/components/add-font-dialog";
import { AddPaletteDialog } from "@/components/add-palette-dialog";
import { EditKitDialog } from "@/components/edit-kit-dialog";
import {
  KitContent,
  KitFontsSection,
  KitPalettesSection,
} from "@/components/kit-content";
import { KitFileBoard } from "@/components/kit-file-board";
import { KitFileUpload } from "@/components/kit-file-upload";
import { KitSourceCard } from "@/components/kit-source-card";
import { PageHeader } from "@/components/page-header";
import { QuickShareButton } from "@/components/quick-share-button";
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
  const role = session?.profile.role ?? "viewer";
  const canEdit = role !== "viewer";

  return (
    <div>
      <PageHeader title={kit.name} description={kit.description ?? undefined}>
        {canEdit ? (
          <>
            <KitFileUpload kitId={kit.id} />
            <AddPaletteDialog kitId={kit.id} />
            <AddFontDialog kitId={kit.id} />
            <QuickShareButton targetType="kit" targetId={kit.id} />
            <ShareDialog targetType="kit" targetId={kit.id} targetName={kit.name} />
            <EditKitDialog
              kitId={kit.id}
              initialName={kit.name}
              initialDescription={kit.description ?? ""}
              hasCover={kit.cover_image_id !== null}
              isAdmin={role === "admin"}
            />
          </>
        ) : null}
      </PageHeader>

      <div className="p-8">
        <div className="mb-8">
          <KitSourceCard
            kitId={kit.id}
            sourceFile={data.sourceFile}
            coverImageId={kit.cover_image_id}
            canEdit={canEdit}
          />
        </div>
        {canEdit ? (
          <div className="space-y-12">
            {data.files.length === 0 &&
            data.sections.length === 0 &&
            data.palettes.length === 0 &&
            data.fonts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing in this kit yet — add files, a palette, or a font.
              </p>
            ) : (
              <KitFileBoard
                kitId={kit.id}
                sections={data.sections.map(({ id, name }) => ({ id, name }))}
                files={data.files.map(({ kitAssetId, sectionId, file }) => ({
                  kitAssetId,
                  sectionId,
                  file: {
                    id: file.id,
                    original_filename: file.original_filename,
                    file_size: file.file_size,
                    mime_type: file.mime_type,
                  },
                }))}
              />
            )}
            <KitPalettesSection data={data} canEdit />
            <KitFontsSection data={data} canEdit />
          </div>
        ) : (
          <KitContent data={data} />
        )}
      </div>
    </div>
  );
}
