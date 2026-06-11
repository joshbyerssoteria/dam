"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProject, renameProject } from "@/lib/actions/projects";
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

export function ProjectActions({
  projectId,
  projectName,
  parentId,
}: {
  projectId: string;
  projectName: string;
  parentId: string | null;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(projectName);
  const [busy, setBusy] = useState(false);

  async function handleRename() {
    setBusy(true);
    const result = await renameProject(projectId, name);
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
    const result = await deleteProject(projectId);
    setBusy(false);
    if (result.ok) {
      toast.success("Project deleted — photos untouched");
      router.push(parentId ? `/photos/projects/${parentId}` : "/photos/projects");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to delete");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Project actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim()) void handleRename();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="rename-project">Name</Label>
              <Input
                id="rename-project"
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
            <DialogTitle>Delete “{projectName}”?</DialogTitle>
            <DialogDescription>
              This deletes the project and any subprojects. The photos
              themselves stay in their folders — nothing is removed from the
              library.
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
