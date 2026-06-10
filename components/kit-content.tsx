import type { KitContentData } from "@/lib/kit-data";
import { FileAssetCard } from "@/components/file-asset-card";
import { FontCard } from "@/components/font-card";
import { PaletteCard } from "@/components/palette-card";

/**
 * Read-only kit rendering: files grouped by section, palettes, fonts.
 * Used on public share pages and for viewers; editors get KitFileBoard
 * for the file area instead (drag-and-drop).
 */
export function KitFilesSection({
  data,
  srcPrefix = "/api/files",
  shareToken,
}: {
  data: KitContentData;
  srcPrefix?: string;
  shareToken?: string;
}) {
  if (data.files.length === 0) return null;

  const groups: Array<{ key: string; title: string | null; files: typeof data.files }> = [];
  const unsectioned = data.files.filter(
    (item) =>
      !item.sectionId ||
      !data.sections.some((section) => section.id === item.sectionId)
  );
  if (unsectioned.length > 0) {
    groups.push({
      key: "none",
      title: data.sections.length > 0 ? "Files" : null,
      files: unsectioned,
    });
  }
  for (const section of data.sections) {
    const files = data.files.filter((item) => item.sectionId === section.id);
    if (files.length > 0) {
      groups.push({ key: section.id, title: section.name, files });
    }
  }

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.title ?? "Files"}>
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.title ?? "Files"}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.files.map(({ kitAssetId, file }) => (
              <FileAssetCard
                key={kitAssetId}
                kitAssetId={kitAssetId}
                file={file}
                srcPrefix={srcPrefix}
                shareToken={shareToken}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function KitPalettesSection({
  data,
  canEdit = false,
}: {
  data: KitContentData;
  canEdit?: boolean;
}) {
  if (data.palettes.length === 0) return null;
  return (
    <section aria-labelledby="kit-palettes">
      <h2
        id="kit-palettes"
        className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Color palettes
      </h2>
      <div className="space-y-4">
        {data.palettes.map(({ palette, colors }) => (
          <PaletteCard
            key={palette.id}
            paletteId={palette.id}
            name={palette.name}
            description={palette.description}
            colors={colors}
            canEdit={canEdit}
          />
        ))}
      </div>
    </section>
  );
}

export function KitFontsSection({
  data,
  srcPrefix = "/api/files",
  canEdit = false,
}: {
  data: KitContentData;
  srcPrefix?: string;
  canEdit?: boolean;
}) {
  if (data.fonts.length === 0) return null;
  return (
    <section aria-labelledby="kit-fonts">
      <h2
        id="kit-fonts"
        className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Fonts
      </h2>
      <div className="space-y-3">
        {data.fonts.map(({ font, files }) => (
          <FontCard
            key={font.id}
            fontId={font.id}
            family={font.family}
            foundry={font.foundry}
            licenseNote={font.license_note}
            source={font.source}
            externalRef={font.external_ref}
            files={files.map(({ fontFile, file }) => ({
              fontFileId: fontFile.id,
              fileId: file.id,
              filename: file.original_filename,
              weight: fontFile.weight,
              style: fontFile.style,
            }))}
            srcPrefix={srcPrefix}
            canEdit={canEdit}
          />
        ))}
      </div>
    </section>
  );
}

/** Full read-only kit body (share pages, viewers). */
export function KitContent({
  data,
  srcPrefix = "/api/files",
  shareToken,
  canEdit = false,
}: {
  data: KitContentData;
  srcPrefix?: string;
  shareToken?: string;
  canEdit?: boolean;
}) {
  const empty =
    data.files.length === 0 &&
    data.palettes.length === 0 &&
    data.fonts.length === 0;

  if (empty) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Nothing in this kit yet.
      </p>
    );
  }

  return (
    <div className="space-y-12">
      <KitFilesSection data={data} srcPrefix={srcPrefix} shareToken={shareToken} />
      <KitPalettesSection data={data} canEdit={canEdit} />
      <KitFontsSection data={data} srcPrefix={srcPrefix} canEdit={canEdit} />
    </div>
  );
}
