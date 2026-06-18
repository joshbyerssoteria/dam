"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteKit, updateKit } from "@/lib/actions/kits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { UploadDropzone } from "@/components/upload-dropzone";

export function EditKitDialog({
  kitId,
  initialName,
  initialDescription,
  hasCover,
  isAdmin,
  isSermonSeries = false,
  initialStartsOn = "",
  initialEndsOn = "",
}: {
  kitId: string;
  initialName: string;
  initialDescription: string;
  hasCover: boolean;
  isAdmin: boolean;
  // Sermon-series kits carry an editable date range shown beneath the title.
  isSermonSeries?: boolean;
  initialStartsOn?: string;
  initialEndsOn?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [startsOn, setStartsOn] = useState(initialStartsOn);
  const [endsOn, setEndsOn] = useState(initialEndsOn);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateKit({
      kitId,
      name,
      description,
      ...(isSermonSeries
        ? { startsOn: startsOn || null, endsOn: endsOn || null }
        : {}),
    });
    setSaving(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to save");
    }
  }

  async function handleDelete() {
    const result = await deleteKit(kitId);
    if (result.ok) {
      toast.success("Kit deleted");
      router.push("/kits");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to delete kit");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmDelete(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit kit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-kit-name">Name</Label>
            <Input
              id="edit-kit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-kit-description">Description</Label>
            <Textarea
              id="edit-kit-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {isSermonSeries ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-kit-starts-on">Start date</Label>
                <Input
                  id="edit-kit-starts-on"
                  type="date"
                  value={startsOn}
                  onChange={(event) => setStartsOn(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-kit-ends-on">End date</Label>
                <Input
                  id="edit-kit-ends-on"
                  type="date"
                  value={endsOn}
                  onChange={(event) => setEndsOn(event.target.value)}
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Thumbnail</Label>
            <UploadDropzone
              intent={{ intent: "kit-cover", kitId }}
              prompt={
                hasCover
                  ? "Drop a new image to replace the thumbnail"
                  : "Drop an image to use as the kit thumbnail"
              }
            />
          </div>

          <DialogFooter>
            <Button onClick={() => void handleSave()} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>

          {isAdmin ? (
            <>
              <Separator />
              {confirmDelete ? (
                <div className="space-y-3">
                  <DialogDescription>
                    Delete this kit and everything in it — files, palettes,
                    fonts, sections? This cannot be undone.
                  </DialogDescription>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete()}
                    >
                      Yes, delete kit
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete kit
                </Button>
              )}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
