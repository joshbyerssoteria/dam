"use client";

import { ExternalLink, Trash2, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteFont } from "@/lib/actions/kits";
import type { FontSource } from "@/lib/database.types";
import { Button } from "@/components/ui/button";

export interface FontCardFile {
  fontFileId: string;
  fileId: string;
  filename: string;
  weight: number | null;
  style: string | null;
}

const SPECIMEN = "Grace and truth came through Jesus Christ";

/**
 * One font in a kit. Uploaded fonts list their files; Google and Adobe
 * fonts load their hosted stylesheet and render a live specimen.
 */
export function FontCard({
  fontId,
  family,
  foundry,
  licenseNote,
  source,
  externalRef,
  files,
  srcPrefix = "/api/files",
  canEdit = false,
}: {
  fontId: string;
  family: string;
  foundry: string | null;
  licenseNote: string | null;
  source: FontSource;
  externalRef: string | null;
  files: FontCardFile[];
  srcPrefix?: string;
  canEdit?: boolean;
}) {
  const router = useRouter();

  async function handleDelete() {
    const result = await deleteFont(fontId);
    if (result.ok) {
      toast.success("Font removed");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to remove font");
    }
  }

  const stylesheet =
    source === "google" && externalRef
      ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(externalRef).replace(/%20/g, "+")}:wght@400;700&display=swap`
      : source === "adobe" && externalRef
        ? `https://use.typekit.net/${encodeURIComponent(externalRef)}.css`
        : null;

  const externalUrl =
    source === "google" && externalRef
      ? `https://fonts.google.com/specimen/${encodeURIComponent(externalRef).replace(/%20/g, "+")}`
      : source === "adobe"
        ? "https://fonts.adobe.com/my_fonts#web_projects-section"
        : null;

  const sourceLabel =
    source === "google" ? "Google Fonts" : source === "adobe" ? "Adobe Fonts" : foundry;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      {stylesheet ? <link rel="stylesheet" href={stylesheet} /> : null}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Type className="size-5 text-muted-foreground" strokeWidth={1.5} />
          <div>
            <h3 className="text-sm font-medium">{family}</h3>
            <p className="text-xs text-muted-foreground">
              {[sourceLabel, licenseNote].filter(Boolean).join(" · ") ||
                "No license note"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {externalUrl ? (
            <Button variant="ghost" size="icon" asChild>
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${family} at ${sourceLabel}`}
              >
                <ExternalLink className="size-4" />
              </a>
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove font ${family}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => void handleDelete()}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {source !== "upload" ? (
        <p
          className="mt-4 truncate text-2xl"
          style={{ fontFamily: `"${family}", sans-serif` }}
          title={SPECIMEN}
        >
          {SPECIMEN}
        </p>
      ) : null}

      {source === "upload" ? (
        files.length > 0 ? (
          <ul className="mt-4 space-y-1">
            {files.map((file) => (
              <li
                key={file.fontFileId}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="truncate">
                  {file.filename}
                  {file.weight ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {file.weight}
                      {file.style ? ` ${file.style}` : ""}
                    </span>
                  ) : null}
                </span>
                <a
                  href={`${srcPrefix}/${file.fileId}?download=1`}
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
        )
      ) : null}
    </div>
  );
}
