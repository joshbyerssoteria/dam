"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface GoogleFamily {
  family: string;
  category: string;
}

export function AddFontDialog({ kitId }: { kitId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Upload tab
  const [family, setFamily] = useState("");
  const [foundry, setFoundry] = useState("");
  const [licenseNote, setLicenseNote] = useState("");
  const [fontId, setFontId] = useState<string | null>(null);

  // Google tab
  const [googleList, setGoogleList] = useState<GoogleFamily[] | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleQuery, setGoogleQuery] = useState("");

  // Adobe tab
  const [adobeFamily, setAdobeFamily] = useState("");
  const [adobeProjectId, setAdobeProjectId] = useState("");

  useEffect(() => {
    if (!open || googleList !== null) return;
    void (async () => {
      try {
        const response = await fetch("/api/fonts/google");
        if (!response.ok) throw new Error();
        const body = (await response.json()) as { families: GoogleFamily[] };
        setGoogleList(body.families);
      } catch {
        setGoogleError("Could not load the Google Fonts list");
      }
    })();
  }, [open, googleList]);

  const googleMatches = useMemo(() => {
    if (!googleList) return [];
    const query = googleQuery.trim().toLowerCase();
    const matches = query
      ? googleList.filter((item) => item.family.toLowerCase().includes(query))
      : googleList;
    return matches.slice(0, 30);
  }, [googleList, googleQuery]);

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFamily("");
      setFoundry("");
      setLicenseNote("");
      setFontId(null);
      setGoogleQuery("");
      setAdobeFamily("");
      setAdobeProjectId("");
      router.refresh();
    }
  }

  async function handleUploadCreate() {
    setSaving(true);
    const result = await addFont({
      kitId,
      family,
      foundry,
      licenseNote,
      source: "upload",
    });
    setSaving(false);
    if (result.ok) {
      setFontId(result.fontId);
    } else {
      toast.error(result.error);
    }
  }

  async function handleGooglePick(pick: GoogleFamily) {
    setSaving(true);
    const result = await addFont({
      kitId,
      family: pick.family,
      foundry: "Google Fonts",
      licenseNote: "Open source — fonts.google.com",
      source: "google",
      externalRef: pick.family,
    });
    setSaving(false);
    if (result.ok) {
      toast.success(`${pick.family} added`);
      reset(false);
    } else {
      toast.error(result.error);
    }
  }

  async function handleAdobeAdd() {
    setSaving(true);
    const result = await addFont({
      kitId,
      family: adobeFamily,
      foundry: "Adobe Fonts",
      licenseNote: "Licensed via Adobe Fonts subscription",
      source: "adobe",
      externalRef: adobeProjectId,
    });
    setSaving(false);
    if (result.ok) {
      toast.success(`${adobeFamily} added`);
      reset(false);
    } else {
      toast.error(result.error);
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {fontId ? `Upload ${family} files` : "Add font"}
          </DialogTitle>
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
          <Tabs defaultValue="upload">
            <TabsList className="w-full">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="google">Google Fonts</TabsTrigger>
              <TabsTrigger value="adobe">Adobe Fonts</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="font-family">Family</Label>
                <Input
                  id="font-family"
                  value={family}
                  onChange={(event) => setFamily(event.target.value)}
                  placeholder="Ivar Display"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-foundry">Foundry (optional)</Label>
                <Input
                  id="font-foundry"
                  value={foundry}
                  onChange={(event) => setFoundry(event.target.value)}
                  placeholder="Letters from Sweden"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="font-license">License note (optional)</Label>
                <Input
                  id="font-license"
                  value={licenseNote}
                  onChange={(event) => setLicenseNote(event.target.value)}
                  placeholder="Desktop license — 5 seats"
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => void handleUploadCreate()}
                  disabled={saving || !family.trim()}
                >
                  {saving ? "Adding…" : "Next: upload files"}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="google" className="mt-4 space-y-3">
              <Input
                autoFocus
                value={googleQuery}
                onChange={(event) => setGoogleQuery(event.target.value)}
                placeholder="Search Google Fonts…"
                aria-label="Search Google Fonts"
              />
              {googleError ? (
                <p className="text-sm text-destructive">{googleError}</p>
              ) : googleList === null ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Loading font list…
                </p>
              ) : (
                <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
                  {googleMatches.map((item) => (
                    <li key={item.family}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleGooglePick(item)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span>{item.family}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.category}
                        </span>
                      </button>
                    </li>
                  ))}
                  {googleMatches.length === 0 ? (
                    <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No matches
                    </li>
                  ) : null}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="adobe" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adobe-family">Font family name</Label>
                <Input
                  id="adobe-family"
                  value={adobeFamily}
                  onChange={(event) => setAdobeFamily(event.target.value)}
                  placeholder="Proxima Nova"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adobe-project">Web project ID</Label>
                <Input
                  id="adobe-project"
                  value={adobeProjectId}
                  onChange={(event) => setAdobeProjectId(event.target.value)}
                  placeholder="abc1def"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  From fonts.adobe.com → Web Projects — the ID in your embed
                  code, e.g. use.typekit.net/<span className="font-mono">abc1def</span>.css
                </p>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => void handleAdobeAdd()}
                  disabled={saving || !adobeFamily.trim() || !adobeProjectId.trim()}
                >
                  {saving ? "Adding…" : "Add Adobe font"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
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
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground hover:border-muted-foreground/50">
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
