"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteKitFolder, renameKitFolder } from "@/lib/actions/kit-folders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function KitFolderActions({
  folderId,
  folderName,
  parentId,
  isAdmin,
}: {
  folderId: string;
  folderName: string;
  parentId: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(folderName);
  const [busy, setBusy] = useState(false);

  async function handleRename() {
    setBusy(true);
    const result = await renameKitFolder(folderId, name);
    setBusy(false);
    if (result.ok) {
      setRenameOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to rename");
    }
  }

  async function handleDelete() {
    setBusy(true);
    const result = await deleteKitFolder(folderId);
    setBusy(false);
    if (result.ok) {
      toast.success("Folder deleted — kits inside moved to the Kits root");
      router.push(parentId ? `/kits/f/${parentId}` : "/kits");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to delete");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Folder actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          {isAdmin ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              Delete folder
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim()) void handleRename();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="rename-kit-folder">Name</Label>
              <Input
                id="rename-kit-folder"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{folderName}”?</DialogTitle>
            <DialogDescription>
              Subfolders are deleted too. Kits inside are not deleted — they
              move back to the Kits root.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void handleDelete()}
            >
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
