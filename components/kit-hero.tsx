"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileUp, ImagePlus, PenTool, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteFont, deletePalette } from "@/lib/actions/kits";
import { isPdfLike } from "@/lib/file-kinds";
import type { FontSource } from "@/lib/database.types";
import { formatBytes } from "@/lib/utils";
import { AddFontDialog } from "@/components/add-font-dialog";
import { AddPaletteDialog } from "@/components/add-palette-dialog";
import { DownloadMenu } from "@/components/download-menu";
import {
  ColorSwatchRow,
  type PaletteCardColor,
} from "@/components/palette-card";
import { uploadWithProgress } from "@/components/upload-dropzone";
import { Button } from "@/components/ui/button";

export interface HeroSourceFile {
  id: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
}

export interface HeroPalette {
  id: string;
  name: string;
  colors: PaletteCardColor[];
}

export interface HeroFont {
  id: string;
  family: string;
  source: FontSource;
  externalRef: string | null;
  licenseNote: string | null;
  files: Array<{ fileId: string; filename: string }>;
}

const SPECIMEN_TEXT = "Aa Bb Cc 123";

function FontRow({
  font,
  srcPrefix,
  canEdit,
}: {
  font: HeroFont;
  srcPrefix: string;
  canEdit: boolean;
}) {
  const router = useRouter();

  const stylesheet =
    font.source === "google" && font.externalRef
      ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.externalRef).replace(/%20/g, "+")}:wght@400;700&display=swap`
      : font.source === "adobe" && font.externalRef
        ? `https://use.typekit.net/${encodeURIComponent(font.externalRef)}.css`
        : null;
  const externalUrl =
    font.source === "google" && font.externalRef
      ? `https://fonts.google.com/specimen/${encodeURIComponent(font.externalRef).replace(/%20/g, "+")}`
      : font.source === "adobe"
        ? "https://fonts.adobe.com/my_fonts#web_projects-section"
        : null;
  const sourceLabel =
    font.source === "google"
      ? "Google Fonts"
      : font.source === "adobe"
        ? "Adobe Fonts"
        : font.licenseNote;

  async function handleDelete() {
    const result = await deleteFont(font.id);
    if (result.ok) {
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to remove font");
    }
  }

  return (
    <div className="group flex items-center gap-4 py-1.5">
      {stylesheet ? <link rel="stylesheet" href={stylesheet} /> : null}
      <span
        className="w-24 shrink-0 truncate text-xl leading-none"
        style={
          font.source !== "upload"
            ? { fontFamily: `"${font.family}", sans-serif` }
            : undefined
        }
        aria-hidden
      >
        {SPECIMEN_TEXT}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{font.family}</p>
        <p className="truncate text-xs text-muted-foreground">
          {sourceLabel ?? "Uploaded"}
          {font.source === "upload" && font.files.length > 0 ? (
            <>
              {" · "}
              {font.files.map((file, index) => (
                <span key={file.fileId}>
                  {index > 0 ? ", " : ""}
                  <a
                    href={`${srcPrefix}/${file.fileId}?download=1`}
                    className="underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {file.filename}
                  </a>
                </span>
              ))}
            </>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {externalUrl ? (
          <Button variant="ghost" size="icon" asChild>
            <a
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${font.family}`}
            >
              <ExternalLink className="size-4" />
            </a>
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove font ${font.family}`}
            className="text-muted-foreground hover:text-destructive"
            onClick={() => void handleDelete()}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Brand essentials, pinned at the top of every kit: the master source file
 * with a 16:9 thumbnail (the kit cover image), the main color palette, and
 * the kit's fonts. Add/replace actions live here for editors.
 */
export function KitHero({
  kitId,
  sourceFile,
  coverImageId,
  palette,
  fonts,
  srcPrefix = "/api/files",
  shareToken,
  canEdit = false,
}: {
  kitId: string;
  sourceFile: HeroSourceFile | null;
  coverImageId: string | null;
  palette: HeroPalette | null;
  fonts: HeroFont[];
  srcPrefix?: string;
  shareToken?: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [sourceProgress, setSourceProgress] = useState<number | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);

  async function handleSourceFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setSourceProgress(0);
    const result = await uploadWithProgress(
      file,
      { intent: "kit-source", kitId },
      setSourceProgress
    );
    setSourceProgress(null);
    if (result.ok) {
      toast.success("Source file updated");
      router.refresh();
    } else {
      toast.error(result.error ?? "Upload failed");
    }
  }

  async function handleCover(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setCoverBusy(true);
    const result = await uploadWithProgress(
      file,
      { intent: "kit-cover", kitId },
      () => {}
    );
    setCoverBusy(false);
    if (result.ok) {
      toast.success("Thumbnail updated");
      router.refresh();
    } else {
      toast.error(result.error ?? "Upload failed");
    }
  }

  async function handleDeletePalette(paletteId: string) {
    const result = await deletePalette(paletteId);
    if (result.ok) {
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to delete palette");
    }
  }

  return (
    <section
      aria-label="Brand essentials"
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      {/* Source file + 16:9 thumbnail */}
      <div className="flex flex-col sm:flex-row">
        <div className="group relative aspect-video shrink-0 bg-muted sm:w-80">
          {coverImageId ? (
            /* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route */
            <img
              src={`${srcPrefix}/${coverImageId}?w=960`}
              alt=""
              draggable={false}
              className="size-full object-cover"
            />
          ) : sourceFile &&
            isPdfLike(sourceFile.mime_type, sourceFile.original_filename) ? (
            /* eslint-disable-next-line @next/next/no-img-element -- first-artboard preview */
            <img
              src={`${srcPrefix}/${sourceFile.id}?w=960`}
              alt=""
              draggable={false}
              className="size-full object-contain"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <PenTool
                className="size-8 text-muted-foreground"
                strokeWidth={1.25}
              />
            </div>
          )}
          {canEdit ? (
            <>
              <button
                type="button"
                disabled={coverBusy}
                onClick={() => coverInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-opacity hover:bg-black/40 hover:opacity-100 focus-visible:bg-black/40 focus-visible:opacity-100"
              >
                <span className="flex items-center gap-2 text-xs font-medium">
                  <ImagePlus className="size-4" />
                  {coverBusy
                    ? "Uploading…"
                    : coverImageId
                      ? "Replace thumbnail"
                      : "Add thumbnail"}
                </span>
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleCover(event.target.files);
                  event.target.value = "";
                }}
              />
            </>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Source file
          </p>
          {sourceFile ? (
            <>
              <p
                className="truncate text-base font-medium"
                title={sourceFile.original_filename}
              >
                {sourceFile.original_filename}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(sourceFile.file_size)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {canEdit
                ? "Upload the master file (.ai, .psd, .indd…)."
                : "No source file."}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            {sourceFile ? (
              <DownloadMenu
                fileId={sourceFile.id}
                mimeType={sourceFile.mime_type}
                filename={sourceFile.original_filename}
                srcPrefix={srcPrefix}
                shareToken={shareToken}
                size="sm"
              />
            ) : null}
            {canEdit ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sourceProgress !== null}
                  onClick={() => sourceInputRef.current?.click()}
                >
                  <FileUp className="size-4" />
                  {sourceProgress !== null
                    ? `${sourceProgress}%`
                    : sourceFile
                      ? "Replace"
                      : "Upload source"}
                </Button>
                <input
                  ref={sourceInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    void handleSourceFile(event.target.files);
                    event.target.value = "";
                  }}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main palette */}
      {palette || canEdit ? (
        <div className="border-t border-border px-6 py-5">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {palette ? `Palette · ${palette.name}` : "Palette"}
            </h3>
            {canEdit ? (
              <div className="flex items-center gap-1">
                {palette ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete palette ${palette.name}`}
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => void handleDeletePalette(palette.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
                <AddPaletteDialog kitId={kitId} />
              </div>
            ) : null}
          </div>
          {palette ? (
            <ColorSwatchRow colors={palette.colors} />
          ) : (
            <p className="text-sm text-muted-foreground">No palette yet.</p>
          )}
        </div>
      ) : null}

      {/* Fonts */}
      {fonts.length > 0 || canEdit ? (
        <div className="border-t border-border px-6 py-5">
          <div className="mb-1 flex items-center justify-between gap-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fonts
            </h3>
            {canEdit ? <AddFontDialog kitId={kitId} /> : null}
          </div>
          {fonts.length > 0 ? (
            <div className="divide-y divide-border/60">
              {fonts.map((font) => (
                <FontRow
                  key={font.id}
                  font={font}
                  srcPrefix={srcPrefix}
                  canEdit={canEdit}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No fonts yet.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
