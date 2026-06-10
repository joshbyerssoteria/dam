import { Download, FileIcon, Type } from "lucide-react";
import type { KitContentData } from "@/lib/kit-data";
import { formatBytes } from "@/lib/utils";
import { PaletteCard } from "@/components/palette-card";
import { KitFileActions } from "@/components/kit-asset-actions";
import { Button } from "@/components/ui/button";

function isPreviewableImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * All asset types of a kit on one page: files, palettes, fonts.
 * Renders for both the app (canEdit) and public share views (srcPrefix).
 */
export function KitContent({
  data,
  srcPrefix = "/api/files",
  canEdit = false,
}: {
  data: KitContentData;
  srcPrefix?: string;
  canEdit?: boolean;
}) {
  const { files, palettes, fonts } = data;
  const empty =
    files.length === 0 && palettes.length === 0 && fonts.length === 0;

  if (empty) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Nothing in this kit yet.
      </p>
    );
  }

  return (
    <div className="space-y-12">
      {files.length > 0 ? (
        <section aria-labelledby="kit-files">
          <h2
            id="kit-files"
            className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Files
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {files.map(({ kitAssetId, file }) => (
              <div
                key={kitAssetId}
                className="group overflow-hidden rounded-lg border border-border bg-card"
              >
                <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                  {isPreviewableImage(file.mime_type) ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route */
                    <img
                      src={`${srcPrefix}/${file.id}${file.mime_type === "image/svg+xml" ? "" : "?w=480"}`}
                      alt={file.original_filename}
                      loading="lazy"
                      className="size-full object-contain p-4"
                    />
                  ) : (
                    <FileIcon
                      className="size-8 text-muted-foreground"
                      strokeWidth={1.25}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {file.original_filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.file_size)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button variant="ghost" size="icon" asChild>
                      <a
                        href={`${srcPrefix}/${file.id}?download=1`}
                        aria-label={`Download ${file.original_filename}`}
                      >
                        <Download className="size-4" />
                      </a>
                    </Button>
                    {canEdit ? <KitFileActions kitAssetId={kitAssetId} /> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {palettes.length > 0 ? (
        <section aria-labelledby="kit-palettes">
          <h2
            id="kit-palettes"
            className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Color palettes
          </h2>
          <div className="space-y-4">
            {palettes.map(({ palette, colors }) => (
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
      ) : null}

      {fonts.length > 0 ? (
        <section aria-labelledby="kit-fonts">
          <h2
            id="kit-fonts"
            className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Fonts
          </h2>
          <div className="space-y-3">
            {fonts.map(({ font, files: fontFiles }) => (
              <div
                key={font.id}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Type
                      className="size-5 text-muted-foreground"
                      strokeWidth={1.5}
                    />
                    <div>
                      <h3 className="text-sm font-medium">{font.family}</h3>
                      <p className="text-xs text-muted-foreground">
                        {[font.foundry, font.license_note]
                          .filter(Boolean)
                          .join(" · ") || "No license note"}
                      </p>
                    </div>
                  </div>
                </div>
                {fontFiles.length > 0 ? (
                  <ul className="mt-4 space-y-1">
                    {fontFiles.map(({ fontFile, file }) => (
                      <li
                        key={fontFile.id}
                        className="flex items-center justify-between gap-4 text-sm"
                      >
                        <span className="truncate">
                          {file.original_filename}
                          {fontFile.weight ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {fontFile.weight}
                              {fontFile.style ? ` ${fontFile.style}` : ""}
                            </span>
                          ) : null}
                        </span>
                        <a
                          href={`${srcPrefix}/${file.id}?download=1`}
                          className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          Download
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No files uploaded yet.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
