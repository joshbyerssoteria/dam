"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { createKitFolder } from "@/lib/actions/kit-folders";
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

export function NewKitFolderDialog({ parentId }: { parentId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    const result = await createKitFolder({ name, parentId });
    setSaving(false);
    if (result.ok) {
      setOpen(false);
      setName("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderPlus className="size-4" />
          New folder
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New kit folder</DialogTitle>
          <DialogDescription>
            Group related kits — e.g. “Sermon Series” holding one kit per
            series.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) void handleCreate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="kit-folder-name">Name</Label>
            <Input
              id="kit-folder-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Sermon Series"
            />
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating…" : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
