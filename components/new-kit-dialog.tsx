"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createKit } from "@/lib/actions/kits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const NO_FOLDER = "__root__";

export function NewKitDialog({
  folders,
  defaultFolderId,
}: {
  folders: Array<{ id: string; name: string }>;
  defaultFolderId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState(defaultFolderId ?? NO_FOLDER);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    const result = await createKit({
      name,
      description,
      kitFolderId: folderId === NO_FOLDER ? null : folderId,
    });
    setSaving(false);
    if (result.ok) {
      setOpen(false);
      router.push(`/kits/${result.slug}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New kit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New kit</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) void handleCreate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="kit-name">Name</Label>
            <Input
              id="kit-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Soteria Brand"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kit-description">Description (optional)</Label>
            <Textarea
              id="kit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Primary brand assets — logos, palettes, type."
              rows={3}
            />
          </div>
          {folders.length > 0 ? (
            <div className="space-y-2">
              <Label>Folder</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FOLDER}>No folder (Kits root)</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating…" : "Create kit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
