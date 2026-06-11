"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderInput,
  Heart,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createFolder, deletePhoto } from "@/lib/actions/folders";
import { favoriteMany, setFavorite } from "@/lib/actions/favorites";
import { batchMovePhotos, batchUpdatePhotos } from "@/lib/actions/photos-batch";
import { EVENT_TYPES } from "@/lib/tagging";
import { formatBytes, formatDate, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DownloadMenu } from "@/components/download-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface GridFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

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

const KEEP = "__keep__";

/**
 * Responsive photo grid + lightbox with metadata sidebar. Optional
 * per-user favorites (heart) and batch selection with zip download,
 * tagging, and favoriting. `srcPrefix` lets the same grid serve the app
 * (/api/files) and public share views (/api/share/[token]/file).
 */
export function PhotoGrid({
  photos,
  srcPrefix = "/api/files",
  shareToken,
  allowDelete = false,
  allowFavorites = false,
  allowBatch = false,
  canEditMeta = false,
  favoriteIds = [],
  folders = [],
}: {
  photos: PhotoGridItem[];
  srcPrefix?: string;
  shareToken?: string;
  allowDelete?: boolean;
  allowFavorites?: boolean;
  allowBatch?: boolean;
  canEditMeta?: boolean;
  favoriteIds?: string[];
  folders?: GridFolder[];
}) {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(favoriteIds)
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  // Anchor for shift-click range selection.
  const lastIndexRef = useRef<number | null>(null);
  const open = openIndex !== null ? photos[openIndex] : null;

  const serverFavorites = favoriteIds.join(",");
  useEffect(() => {
    setFavorites(new Set(serverFavorites ? serverFavorites.split(",") : []));
  }, [serverFavorites]);

  // Clear selections that no longer exist (e.g. after deletes).
  const photoIdSet = useMemo(() => new Set(photos.map((p) => p.id)), [photos]);
  useEffect(() => {
    setSelected((current) => {
      const next = new Set([...current].filter((id) => photoIdSet.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [photoIdSet]);

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

  async function toggleFavorite(photoId: string) {
    const next = !favorites.has(photoId);
    setFavorites((current) => {
      const updated = new Set(current);
      if (next) updated.add(photoId);
      else updated.delete(photoId);
      return updated;
    });
    const result = await setFavorite(photoId, next);
    if (!result.ok) {
      toast.error(result.error ?? "Failed to update favorite");
      router.refresh();
    }
  }

  function toggleSelected(index: number, shiftKey = false) {
    const photo = photos[index];
    if (!photo) return;
    const anchor = lastIndexRef.current;
    if (shiftKey && anchor !== null) {
      // Select the contiguous range between the anchor and this photo.
      const from = Math.min(anchor, index);
      const to = Math.max(anchor, index);
      setSelected((current) => {
        const next = new Set(current);
        for (let i = from; i <= to; i += 1) {
          const p = photos[i];
          if (p) next.add(p.id);
        }
        return next;
      });
      return;
    }
    lastIndexRef.current = index;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(photo.id)) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(photos.map((p) => p.id)));
  }

  async function handleBatchFavorite() {
    const ids = [...selected];
    const result = await favoriteMany(ids);
    if (result.ok) {
      setFavorites((current) => new Set([...current, ...ids]));
      toast.success(`${ids.length} added to Favorites`);
    } else {
      toast.error(result.error ?? "Failed to favorite");
    }
  }

  const selectionActive = selected.size > 0;

  if (photos.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No photos yet.
      </p>
    );
  }

  const allSelected = selected.size === photos.length;

  return (
    <>
      {allowBatch ? (
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (allSelected ? setSelected(new Set()) : selectAll())}
            className="text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {allSelected ? "Clear selection" : `Select all ${photos.length}`}
          </button>
          {selectionActive ? (
            <span className="text-sm text-muted-foreground">
              {selected.size} selected
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Tip: shift-click to select a range
            </span>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {photos.map((photo, index) => {
          const isSelected = selected.has(photo.id);
          const isFavorite = favorites.has(photo.id);
          return (
            <div key={photo.id} className="group relative aspect-square">
              <button
                type="button"
                onClick={(event) =>
                  selectionActive && allowBatch
                    ? toggleSelected(index, event.shiftKey)
                    : setOpenIndex(index)
                }
                className={cn(
                  "size-full overflow-hidden bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                  isSelected && "ring-2 ring-inset ring-[#C2912D]"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route */}
                <img
                  src={`${srcPrefix}/${photo.fileId}?w=480`}
                  alt={photo.aiCaption ?? photo.originalFilename}
                  loading="lazy"
                  draggable={false}
                  className={cn(
                    "size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]",
                    isSelected && "opacity-80"
                  )}
                />
              </button>

              {allowBatch ? (
                <button
                  type="button"
                  aria-label={isSelected ? "Deselect photo" : "Select photo"}
                  onClick={(event) => toggleSelected(index, event.shiftKey)}
                  className={cn(
                    "absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border transition-opacity",
                    isSelected
                      ? "border-transparent bg-[#C2912D] text-white opacity-100"
                      : "border-white/80 bg-black/30 text-white opacity-0 hover:bg-black/50 group-hover:opacity-100"
                  )}
                >
                  {isSelected ? <Check className="size-3.5" /> : null}
                </button>
              ) : null}

              {allowFavorites ? (
                <button
                  type="button"
                  aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                  onClick={() => void toggleFavorite(photo.id)}
                  className={cn(
                    "absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/30 transition-opacity hover:bg-black/50",
                    isFavorite
                      ? "text-[#C2912D] opacity-100"
                      : "text-white opacity-0 group-hover:opacity-100"
                  )}
                >
                  <Heart
                    className="size-3.5"
                    fill={isFavorite ? "currentColor" : "none"}
                  />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Batch action bar */}
      {allowBatch && selectionActive ? (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
            <span className="px-2 text-sm font-medium">
              {selected.size} selected
            </span>
            <Button size="sm" variant="ghost" asChild>
              <a href={`/api/photos/zip?ids=${[...selected].join(",")}`}>
                <Download className="size-4" />
                Download
              </a>
            </Button>
            {allowFavorites ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleBatchFavorite()}
              >
                <Heart className="size-4" />
                Favorite
              </Button>
            ) : null}
            {canEditMeta && folders.length >= 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMoveDialogOpen(true)}
              >
                <FolderInput className="size-4" />
                Move
              </Button>
            ) : null}
            {canEditMeta ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setTagDialogOpen(true)}
              >
                <Tags className="size-4" />
                Tag / edit
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setSelected(new Set())}
            >
              <X className="size-4" />
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {canEditMeta ? (
        <>
          <BatchTagDialog
            open={tagDialogOpen}
            onOpenChange={setTagDialogOpen}
            photoIds={[...selected]}
            onDone={() => {
              setSelected(new Set());
              router.refresh();
            }}
          />
          <BatchMoveDialog
            open={moveDialogOpen}
            onOpenChange={setMoveDialogOpen}
            photoIds={[...selected]}
            folders={folders}
            onDone={() => {
              setSelected(new Set());
              router.refresh();
            }}
          />
        </>
      ) : null}

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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
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
                {allowFavorites ? (
                  <button
                    type="button"
                    aria-label={
                      favorites.has(open.id)
                        ? "Remove from Favorites"
                        : "Add to Favorites"
                    }
                    onClick={() => void toggleFavorite(open.id)}
                    className={cn(
                      "shrink-0 rounded-full p-1.5 transition-colors hover:bg-accent",
                      favorites.has(open.id)
                        ? "text-[#C2912D]"
                        : "text-muted-foreground"
                    )}
                  >
                    <Heart
                      className="size-4"
                      fill={favorites.has(open.id) ? "currentColor" : "none"}
                    />
                  </button>
                ) : null}
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
              <DownloadMenu
                fileId={open.fileId}
                mimeType="image/jpeg"
                srcPrefix={srcPrefix}
                shareToken={shareToken}
                size="sm"
              />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function BatchTagDialog({
  open,
  onOpenChange,
  photoIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoIds: string[];
  onDone: () => void;
}) {
  const [tags, setTags] = useState("");
  const [eventType, setEventType] = useState(KEEP);
  const [photographer, setPhotographer] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleApply() {
    setSaving(true);
    const result = await batchUpdatePhotos({
      photoIds,
      addTags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      eventType: eventType === KEEP ? null : eventType,
      photographerName: photographer.trim() || null,
    });
    setSaving(false);
    if (result.ok) {
      toast.success(`${photoIds.length} photo(s) updated`);
      onOpenChange(false);
      setTags("");
      setEventType(KEEP);
      setPhotographer("");
      onDone();
    } else {
      toast.error(result.error ?? "Failed to update");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {photoIds.length} photo(s)</DialogTitle>
          <DialogDescription>
            Tags are added to each photo; fields left blank stay unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="batch-tags">Add tags (comma separated)</Label>
            <Input
              id="batch-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="easter, baptism, worship night"
            />
          </div>
          <div className="space-y-2">
            <Label>Event type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep current</SelectItem>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="batch-photographer">Photographer</Label>
            <Input
              id="batch-photographer"
              value={photographer}
              onChange={(event) => setPhotographer(event.target.value)}
              placeholder="Leave blank to keep current"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void handleApply()} disabled={saving}>
            {saving ? "Applying…" : "Apply to selection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Flatten the folder tree into select options with depth-based indent. */
function flattenFolders(folders: GridFolder[]): Array<{ id: string; label: string }> {
  const byParent = new Map<string | null, GridFolder[]>();
  for (const folder of folders) {
    const key = folder.parent_id ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), folder]);
  }
  const result: Array<{ id: string; label: string }> = [];
  function walk(parentId: string | null, depth: number) {
    const children = (byParent.get(parentId) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const folder of children) {
      result.push({ id: folder.id, label: `${"\u00A0".repeat(depth * 3)}${folder.name}` });
      walk(folder.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

function BatchMoveDialog({
  open,
  onOpenChange,
  photoIds,
  folders,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoIds: string[];
  folders: GridFolder[];
  onDone: () => void;
}) {
  const [destinationId, setDestinationId] = useState<string>("");
  const [newFolderName, setNewFolderName] = useState("");
  const [moving, setMoving] = useState(false);
  const options = useMemo(() => flattenFolders(folders), [folders]);

  const creatingNew = newFolderName.trim().length > 0;
  const canApply = creatingNew || destinationId !== "";

  async function handleMove() {
    setMoving(true);
    let targetId = destinationId;

    if (creatingNew) {
      // New folder goes inside the selected destination (or at the root).
      const created = await createFolder({
        name: newFolderName.trim(),
        parentId: destinationId || null,
      });
      if (!created.ok) {
        setMoving(false);
        toast.error(created.error);
        return;
      }
      targetId = created.folderId;
    }

    const result = await batchMovePhotos({ photoIds, folderId: targetId });
    setMoving(false);
    if (result.ok) {
      toast.success(`${photoIds.length} photo(s) moved`);
      onOpenChange(false);
      setNewFolderName("");
      setDestinationId("");
      onDone();
    } else {
      toast.error(result.error ?? "Failed to move photos");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {photoIds.length} photo(s)</DialogTitle>
          <DialogDescription>
            Pick a destination folder — or name a new one to create it
            {destinationId ? " inside the selected folder" : " at the top level"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Destination folder</Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a folder" />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-folder-name">
              New folder (optional)
            </Label>
            <Input
              id="new-folder-name"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="e.g. Easter 2026 — selects"
            />
            {creatingNew ? (
              <p className="text-xs text-muted-foreground">
                Photos will move into the new folder
                {destinationId ? " inside the selected folder." : " at the top level."}
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void handleMove()} disabled={moving || !canApply}>
            {moving ? "Moving…" : creatingNew ? "Create & move" : "Move photos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
