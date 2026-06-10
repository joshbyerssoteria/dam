"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function RevokeButton({
  action,
  label = "Revoke",
}: {
  action: () => Promise<{ ok: boolean; error?: string }>;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      toast.success("Revoked");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to revoke");
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={() => void handleClick()}
      className="text-muted-foreground hover:text-destructive"
    >
      {busy ? "Revoking…" : label}
    </Button>
  );
}
