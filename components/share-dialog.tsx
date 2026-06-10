"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { createShareLink } from "@/lib/actions/shares";
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

export function ShareDialog({
  targetType,
  targetId,
  targetName,
}: {
  targetType: "kit" | "folder";
  targetId: string;
  targetName: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setCreating(true);
    const result = await createShareLink({
      targetType,
      targetId,
      password,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
    setCreating(false);
    if (result.ok) {
      const prefix = targetType === "kit" ? "/k" : "/f";
      setShareUrl(`${window.location.origin}${prefix}/${result.token}`);
    } else {
      toast.error(result.error);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setShareUrl(null);
      setPassword("");
      setExpiresAt("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="size-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share “{targetName}”</DialogTitle>
          <DialogDescription>
            Anyone with the link can view{" "}
            {targetType === "kit" ? "this kit" : "this folder"} and download
            its contents.
          </DialogDescription>
        </DialogHeader>

        {shareUrl ? (
          <div className="space-y-3">
            <Label htmlFor="share-url">Share link</Label>
            <div className="flex gap-2">
              <Input
                id="share-url"
                readOnly
                value={shareUrl}
                className="font-mono text-xs"
                onFocus={(event) => event.target.select()}
              />
              <Button variant="outline" size="icon" onClick={() => void handleCopy()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="share-password">Password (optional)</Label>
              <Input
                id="share-password"
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Leave blank for no password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="share-expiry">Expires (optional)</Label>
              <Input
                id="share-expiry"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button onClick={() => void handleCreate()} disabled={creating}>
                {creating ? "Creating…" : "Create link"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
