import { FileIcon } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { DownloadMenu } from "@/components/download-menu";
import { KitFileActions } from "@/components/kit-asset-actions";

export interface FileAssetCardFile {
  id: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
}

export function FileAssetCard({
  kitAssetId,
  file,
  srcPrefix = "/api/files",
  shareToken,
  canEdit = false,
}: {
  kitAssetId: string;
  file: FileAssetCardFile;
  srcPrefix?: string;
  shareToken?: string;
  canEdit?: boolean;
}) {
  const isImage = file.mime_type.startsWith("image/");

  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex aspect-[4/3] items-center justify-center bg-muted">
        {isImage ? (
          /* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route */
          <img
            src={`${srcPrefix}/${file.id}${file.mime_type === "image/svg+xml" ? "" : "?w=480"}`}
            alt={file.original_filename}
            loading="lazy"
            draggable={false}
            className="size-full object-contain p-4"
          />
        ) : (
          <FileIcon className="size-8 text-muted-foreground" strokeWidth={1.25} />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium" title={file.original_filename}>
            {file.original_filename}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(file.file_size)}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <DownloadMenu
            fileId={file.id}
            mimeType={file.mime_type}
            srcPrefix={srcPrefix}
            shareToken={shareToken}
          />
          {canEdit ? <KitFileActions kitAssetId={kitAssetId} /> : null}
        </div>
      </div>
    </div>
  );
}
