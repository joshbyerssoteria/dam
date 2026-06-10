"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePalette } from "@/lib/actions/kits";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface PaletteCardColor {
  id: string;
  hex: string;
  name: string | null;
  role: string | null;
}

/** Live palette swatches with click-to-copy hex (JetBrains Mono per spec). */
export function PaletteCard({
  paletteId,
  name,
  description,
  colors,
  canEdit,
}: {
  paletteId: string;
  name: string;
  description: string | null;
  colors: PaletteCardColor[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyHex(color: PaletteCardColor) {
    await navigator.clipboard.writeText(color.hex);
    setCopiedId(color.id);
    setTimeout(() => setCopiedId(null), 1200);
  }

  async function handleDelete() {
    const result = await deletePalette(paletteId);
    if (result.ok) {
      toast.success("Palette deleted");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to delete palette");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-4 px-5 pt-4">
        <div>
          <h3 className="text-sm font-medium">{name}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {canEdit ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete palette ${name}`}
            className="-mr-2 -mt-1 text-muted-foreground hover:text-destructive"
            onClick={() => void handleDelete()}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 p-5">
        {colors.map((color) => (
          <button
            key={color.id}
            type="button"
            onClick={() => void copyHex(color)}
            title={`Copy ${color.hex}`}
            className="group w-24 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span
              className="block h-16 w-full rounded-md border border-black/5 transition-transform group-hover:scale-[1.03]"
              style={{ backgroundColor: color.hex }}
            />
            <span className="mt-1.5 block truncate text-xs font-medium">
              {color.name ?? color.role ?? " "}
            </span>
            <span className="block font-mono text-xs text-muted-foreground">
              {copiedId === color.id ? "Copied" : color.hex}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
