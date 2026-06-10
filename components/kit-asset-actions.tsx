"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { removeKitFile } from "@/lib/actions/kits";
import { Button } from "@/components/ui/button";

export function KitFileActions({ kitAssetId }: { kitAssetId: string }) {
  const router = useRouter();

  async function handleRemove() {
    const result = await removeKitFile(kitAssetId);
    if (result.ok) {
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to remove");
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Remove from kit"
      className="text-muted-foreground hover:text-destructive"
      onClick={() => void handleRemove()}
    >
      <X className="size-4" />
    </Button>
  );
}
