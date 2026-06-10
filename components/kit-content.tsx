import type { KitContentData } from "@/lib/kit-data";
import { FileAssetCard } from "@/components/file-asset-card";
import { PaletteCard } from "@/components/palette-card";

/**
 * Read-only kit file rendering grouped by section. Used on public share
 * pages and for viewers; editors get KitFileBoard (drag-and-drop) instead.
 * The source file, main palette, and fonts render in KitHero.
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

/** Palettes beyond the main one shown in the hero. */
export function KitExtraPalettes({
  data,
  canEdit = false,
}: {
  data: KitContentData;
  canEdit?: boolean;
}) {
  const extras = data.palettes.slice(1);
  if (extras.length === 0) return null;
  return (
    <section aria-labelledby="kit-palettes">
      <h2
        id="kit-palettes"
        className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        More palettes
      </h2>
      <div className="space-y-4">
        {extras.map(({ palette, colors }) => (
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
