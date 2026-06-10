"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { createUploadToken } from "@/lib/actions/upload-tokens";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function NewUploadTokenDialog({
  folders,
}: {
  folders: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [folderId, setFolderId] = useState("");
  const [photographerName, setPhotographerName] = useState("");
  const [photographerEmail, setPhotographerEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxFiles, setMaxFiles] = useState("");
  const [instructions, setInstructions] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setCreating(true);
    const result = await createUploadToken({
      targetFolderId: folderId,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      maxFiles: maxFiles ? Number(maxFiles) : null,
      photographerName,
      photographerEmail,
      instructions,
    });
    setCreating(false);
    if (result.ok) {
      setCreatedUrl(`${window.location.origin}/upload/${result.token}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleCopy() {
    if (!createdUrl) return;
    await navigator.clipboard.writeText(createdUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFolderId("");
      setPhotographerName("");
      setPhotographerEmail("");
      setExpiresAt("");
      setMaxFiles("");
      setInstructions("");
      setCreatedUrl(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New upload link
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New photographer upload link</DialogTitle>
          <DialogDescription>
            The link allows uploads into one folder — nothing else.
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="space-y-3">
            <Label htmlFor="upload-url">Upload link</Label>
            <div className="flex gap-2">
              <Input
                id="upload-url"
                readOnly
                value={createdUrl}
                className="font-mono text-xs"
                onFocus={(event) => event.target.select()}
              />
              <Button variant="outline" size="icon" onClick={() => void handleCopy()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send this to the photographer. It expires
              {expiresAt ? ` ${new Date(expiresAt).toLocaleString()}` : " never"}
              .
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destination folder</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a folder" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ut-name">Photographer name</Label>
                <Input
                  id="ut-name"
                  value={photographerName}
                  onChange={(event) => setPhotographerName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ut-email">Email</Label>
                <Input
                  id="ut-email"
                  type="email"
                  value={photographerEmail}
                  onChange={(event) => setPhotographerEmail(event.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ut-expiry">Expires</Label>
                <Input
                  id="ut-expiry"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ut-max">Max files (optional)</Label>
                <Input
                  id="ut-max"
                  type="number"
                  min={1}
                  value={maxFiles}
                  onChange={(event) => setMaxFiles(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ut-instructions">Instructions (optional)</Label>
              <Textarea
                id="ut-instructions"
                rows={3}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="Shown on the upload page — e.g. which service, what to prioritize."
              />
            </div>
            <DialogFooter>
              <Button
                onClick={() => void handleCreate()}
                disabled={creating || !folderId}
              >
                {creating ? "Creating…" : "Create link"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
