"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, PenTool } from "lucide-react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/utils";
import { DownloadMenu } from "@/components/download-menu";
import { uploadWithProgress } from "@/components/upload-dropzone";
import { Button } from "@/components/ui/button";

export interface KitSourceFile {
  id: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
}

/**
 * The kit's primary source file (e.g. the master .ai), pinned at the top.
 * The kit's cover image doubles as its thumbnail since source formats
 * aren't previewable in the browser.
 */
export function KitSourceCard({
  kitId,
  sourceFile,
  coverImageId,
  srcPrefix = "/api/files",
  shareToken,
  canEdit = false,
}: {
  kitId: string;
  sourceFile: KitSourceFile | null;
  coverImageId: string | null;
  srcPrefix?: string;
  shareToken?: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  if (!sourceFile && !canEdit) return null;

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setProgress(0);
    const result = await uploadWithProgress(
      file,
      { intent: "kit-source", kitId },
      setProgress
    );
    setProgress(null);
    if (result.ok) {
      toast.success("Source file updated");
      router.refresh();
    } else {
      toast.error(result.error ?? "Upload failed");
    }
  }

  return (
    <section
      aria-label="Source file"
      className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {coverImageId ? (
          /* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route */
          <img
            src={`${srcPrefix}/${coverImageId}?w=240`}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <PenTool className="size-6 text-muted-foreground" strokeWidth={1.5} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Source file
        </p>
        {sourceFile ? (
          <>
            <p
              className="truncate text-sm font-medium"
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
            No source file yet — upload the master file (.ai, .psd, .indd…).
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {sourceFile ? (
          <DownloadMenu
            fileId={sourceFile.id}
            mimeType={sourceFile.mime_type}
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
              disabled={progress !== null}
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="size-4" />
              {progress !== null
                ? `${progress}%`
                : sourceFile
                  ? "Replace"
                  : "Upload"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                void handleFile(event.target.files);
                event.target.value = "";
              }}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
