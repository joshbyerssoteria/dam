import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { heroFontsFrom, loadKitContent } from "@/lib/kit-data";
import { EditKitDialog } from "@/components/edit-kit-dialog";
import { KitExtraPalettes, KitFilesSection } from "@/components/kit-content";
import { KitFileBoard } from "@/components/kit-file-board";
import { KitFileUpload } from "@/components/kit-file-upload";
import { KitHero } from "@/components/kit-hero";
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

  const [data, { data: kitFolders }] = await Promise.all([
    loadKitContent(db, kit),
    db.from("kit_folders").select("id, name").order("name"),
  ]);
  const role = session?.profile.role ?? "viewer";
  const canEdit = role !== "viewer";

  const mainPalette = data.palettes[0]
    ? {
        id: data.palettes[0].palette.id,
        name: data.palettes[0].palette.name,
        colors: data.palettes[0].colors,
      }
    : null;

  return (
    <div>
      <PageHeader title={kit.name} description={kit.description ?? undefined}>
        {canEdit ? (
          <>
            <KitFileUpload kitId={kit.id} />
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

      <div className="space-y-12 p-8">
        <KitHero
          kitId={kit.id}
          sourceFile={data.sourceFile}
          coverImageId={kit.cover_image_id}
          palette={mainPalette}
          fonts={heroFontsFrom(data)}
          canEdit={canEdit}
        />

        {canEdit ? (
          <KitFileBoard
            kitId={kit.id}
            folders={kitFolders ?? []}
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
        ) : (
          <KitFilesSection data={data} />
        )}

        <KitExtraPalettes data={data} canEdit={canEdit} />
      </div>
    </div>
  );
}
