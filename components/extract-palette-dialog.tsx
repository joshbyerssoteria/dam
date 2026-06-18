"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { addPalette, suggestPaletteFromSource } from "@/lib/actions/kits";
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

interface DraftColor {
  hex: string;
  name: string;
  role: string;
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

/**
 * Extract a probable palette from the kit's source file (its master .ai),
 * then let the editor review/adjust before saving. Triggered from KitHero.
 */
export function ExtractPaletteDialog({ kitId }: { kitId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [autoNamed, setAutoNamed] = useState(true);
  const [name, setName] = useState("Brand palette");
  const [colors, setColors] = useState<DraftColor[]>([]);
  const [saving, setSaving] = useState(false);

  const valid =
    name.trim().length > 0 &&
    colors.length > 0 &&
    colors.every((color) => HEX_RE.test(color.hex));

  async function runExtraction() {
    setExtracting(true);
    setExtractError(null);
    setColors([]);
    const result = await suggestPaletteFromSource(kitId);
    setExtracting(false);
    if (result.ok) {
      setColors(result.colors);
      setAutoNamed(result.named);
      setName(result.suggestedName);
    } else {
      setExtractError(result.error);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      void runExtraction();
    } else {
      // Reset so a re-open starts clean.
      setColors([]);
      setExtractError(null);
      setName("Brand palette");
    }
  }

  function updateColor(index: number, patch: Partial<DraftColor>) {
    setColors((current) =>
      current.map((color, colorIndex) =>
        colorIndex === index ? { ...color, ...patch } : color
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    const result = await addPalette({ kitId, name, description: "", colors });
    setSaving(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to save palette");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="size-4" />
          Palette from source
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Palette from source file</DialogTitle>
          <DialogDescription>
            Colors detected in the source artwork. Review, rename, and adjust
            before saving.
          </DialogDescription>
        </DialogHeader>

        {extracting ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Reading colors from the source file…
          </p>
        ) : extractError ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">{extractError}</p>
            <Button variant="outline" size="sm" onClick={() => void runExtraction()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="extract-palette-name">Name</Label>
              <Input
                id="extract-palette-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Brand palette"
              />
            </div>

            {!autoNamed && colors.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Detected from the artwork — add names and roles as needed.
              </p>
            ) : null}

            <div className="space-y-3">
              <Label>Colors</Label>
              {colors.map((color, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pick color"
                    value={
                      HEX_RE.test(color.hex)
                        ? color.hex.startsWith("#")
                          ? color.hex
                          : `#${color.hex}`
                        : "#000000"
                    }
                    onChange={(event) =>
                      updateColor(index, { hex: event.target.value })
                    }
                    className="size-9 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <Input
                    value={color.hex}
                    onChange={(event) =>
                      updateColor(index, { hex: event.target.value })
                    }
                    placeholder="#1A1A1A"
                    className="w-28 font-mono text-xs"
                    aria-label="Hex value"
                  />
                  <Input
                    value={color.name}
                    onChange={(event) =>
                      updateColor(index, { name: event.target.value })
                    }
                    placeholder="Name"
                    aria-label="Color name"
                  />
                  <Input
                    value={color.role}
                    onChange={(event) =>
                      updateColor(index, { role: event.target.value })
                    }
                    placeholder="Role"
                    aria-label="Color role"
                    className="w-28"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove color"
                    disabled={colors.length === 1}
                    onClick={() =>
                      setColors((current) =>
                        current.filter((_, colorIndex) => colorIndex !== index)
                      )
                    }
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setColors((current) => [
                    ...current,
                    { hex: "#000000", name: "", role: "" },
                  ])
                }
              >
                <Plus className="size-4" />
                Add color
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => void handleSave()}
            disabled={!valid || saving || extracting}
          >
            {saving ? "Saving…" : "Save palette"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
