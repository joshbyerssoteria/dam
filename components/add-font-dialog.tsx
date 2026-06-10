"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addFont } from "@/lib/actions/kits";
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

export function AddFontDialog({ kitId }: { kitId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [family, setFamily] = useState("");
  const [foundry, setFoundry] = useState("");
  const [licenseNote, setLicenseNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [fontId, setFontId] = useState<string | null>(null);

  async function handleCreate() {
    setSaving(true);
    const result = await addFont({ kitId, family, foundry, licenseNote });
    setSaving(false);
    if (result.ok) {
      setFontId(result.fontId);
    } else {
      toast.error(result.error);
    }
  }

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFamily("");
      setFoundry("");
      setLicenseNote("");
      setFontId(null);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Font
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fontId ? `Upload ${family} files` : "Add font"}</DialogTitle>
        </DialogHeader>

        {fontId ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload the font files (OTF, TTF, WOFF, WOFF2). You can add
              several weights and styles.
            </p>
            <FontFileUpload fontId={fontId} />
            <DialogFooter>
              <Button onClick={() => reset(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="font-family">Family</Label>
              <Input
                id="font-family"
                value={family}
                onChange={(event) => setFamily(event.target.value)}
                placeholder="Inter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="font-foundry">Foundry (optional)</Label>
              <Input
                id="font-foundry"
                value={foundry}
                onChange={(event) => setFoundry(event.target.value)}
                placeholder="rsms"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="font-license">License note (optional)</Label>
              <Input
                id="font-license"
                value={licenseNote}
                onChange={(event) => setLicenseNote(event.target.value)}
                placeholder="SIL OFL — free for all use"
              />
            </div>
            <DialogFooter>
              <Button
                onClick={() => void handleCreate()}
                disabled={saving || !family.trim()}
              >
                {saving ? "Adding…" : "Next: upload files"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FontFileUpload({ fontId }: { fontId: string }) {
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const file of [...files]) {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("intent", "font-file");
      formData.set("fontId", fontId);
      const response = await fetch("/api/upload/direct", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        setCount((current) => current + 1);
      } else {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        toast.error(body?.error ?? `Failed to upload ${file.name}`);
      }
    }
    setBusy(false);
  }

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground hover:border-muted-foreground/50">
        {busy ? "Uploading…" : "Click to choose font files"}
        <input
          type="file"
          multiple
          accept=".otf,.ttf,.woff,.woff2"
          className="hidden"
          disabled={busy}
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {count > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {count} file{count === 1 ? "" : "s"} uploaded
        </p>
      ) : null}
    </div>
  );
}
