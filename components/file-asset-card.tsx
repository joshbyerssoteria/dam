import { isPdfLike } from "@/lib/file-kinds";
import { formatBytes } from "@/lib/utils";
import { AssetPreview } from "@/components/asset-preview";
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
  const previewable =
    isImage || isPdfLike(file.mime_type, file.original_filename);
  const ext = (file.original_filename.split(".").pop() || "file")
    .slice(0, 4)
    .toUpperCase();

  return (
    <div className="group overflow-hidden border border-border bg-card">
      <div className="flex aspect-[4/3] items-center justify-center bg-asset">
        <AssetPreview
          src={`${srcPrefix}/${file.id}${file.mime_type === "image/svg+xml" ? "" : "?w=480"}`}
          alt={file.original_filename}
          ext={ext}
          previewable={previewable}
        />
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
            filename={file.original_filename}
            srcPrefix={srcPrefix}
            shareToken={shareToken}
          />
          {canEdit ? <KitFileActions kitAssetId={kitAssetId} /> : null}
        </div>
      </div>
    </div>
  );
}
