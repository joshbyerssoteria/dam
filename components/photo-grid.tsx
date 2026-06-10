"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deletePhoto } from "@/lib/actions/folders";
import { formatBytes, formatDate, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface PhotoGridItem {
  id: string;
  fileId: string;
  originalFilename: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  aiTags: string[];
  aiCaption: string | null;
  aiScene: string | null;
  eventType: string | null;
  takenAt: string | null;
  photographerName: string | null;
  createdAt: string;
  canDelete: boolean;
}

/**
 * Responsive photo grid + lightbox with metadata sidebar.
 * `srcPrefix` lets the same grid serve the app (/api/files) and public
 * share views (/api/share/[token]/file).
 */
export function PhotoGrid({
  photos,
  srcPrefix = "/api/files",
  allowDelete = false,
}: {
  photos: PhotoGridItem[];
  srcPrefix?: string;
  allowDelete?: boolean;
}) {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex !== null ? photos[openIndex] : null;

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) => {
        if (current === null || photos.length === 0) return current;
        return (current + delta + photos.length) % photos.length;
      });
    },
    [photos.length]
  );

  useEffect(() => {
    if (openIndex === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenIndex(null);
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, step]);

  async function handleDelete(photoId: string) {
    const result = await deletePhoto(photoId);
    if (result.ok) {
      toast.success("Photo deleted");
      setOpenIndex(null);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to delete");
    }
  }

  if (photos.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No photos yet.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="group relative aspect-square overflow-hidden bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route; Next optimizer cannot send cookies */}
            <img
              src={`${srcPrefix}/${photo.fileId}?w=480`}
              alt={photo.aiCaption ?? photo.originalFilename}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </button>
        ))}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex bg-background"
          role="dialog"
          aria-modal="true"
          aria-label={open.originalFilename}
        >
          <div className="relative flex min-w-0 flex-1 items-center justify-center bg-neutral-950">
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route */}
            <img
              src={`${srcPrefix}/${open.fileId}?w=1600`}
              alt={open.aiCaption ?? open.originalFilename}
              className="max-h-full max-w-full object-contain"
            />
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpenIndex(null)}
              className="absolute left-4 top-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            >
              <X className="size-4" />
            </button>
            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => step(-1)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => step(1)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : null}
          </div>

          <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-border">
            <div className="space-y-6 p-6">
              <div>
                <h2 className="break-words text-sm font-medium">
                  {open.originalFilename}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatBytes(open.fileSize)}
                  {open.width && open.height
                    ? ` · ${open.width}×${open.height}`
                    : ""}
                </p>
              </div>

              {open.aiCaption ? (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Caption
                  </h3>
                  <p className="mt-1.5 text-sm">{open.aiCaption}</p>
                </div>
              ) : null}

              {open.aiScene ? (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Scene
                  </h3>
                  <p className="mt-1.5 text-sm">{open.aiScene}</p>
                </div>
              ) : null}

              {open.aiTags.length > 0 ? (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Tags
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {open.aiTags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <dl className="space-y-2 text-sm">
                {open.eventType ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Event</dt>
                    <dd>{open.eventType.replace(/_/g, " ")}</dd>
                  </div>
                ) : null}
                {open.photographerName ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Photographer</dt>
                    <dd>{open.photographerName}</dd>
                  </div>
                ) : null}
                {open.takenAt ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Taken</dt>
                    <dd>{formatDate(open.takenAt)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Uploaded</dt>
                  <dd>{formatDate(open.createdAt)}</dd>
                </div>
              </dl>
            </div>

            <div
              className={cn(
                "mt-auto flex gap-2 border-t border-border p-4",
                allowDelete && open.canDelete ? "justify-between" : "justify-end"
              )}
            >
              {allowDelete && open.canDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDelete(open.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              ) : null}
              <Button size="sm" asChild>
                <a href={`${srcPrefix}/${open.fileId}?download=1`}>
                  <Download className="size-4" />
                  Original
                </a>
              </Button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
