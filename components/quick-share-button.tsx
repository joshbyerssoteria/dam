"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";
import { quickShare } from "@/lib/actions/shares";
import { Button } from "@/components/ui/button";

/** One click: get-or-create a share link and copy its URL. */
export function QuickShareButton({
  targetType,
  targetId,
  size = "sm",
  label = "Copy share link",
}: {
  targetType: "kit" | "folder";
  targetId: string;
  size?: "sm" | "icon";
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    setBusy(true);
    const result = await quickShare(targetType, targetId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    await navigator.clipboard.writeText(`${window.location.origin}${result.path}`);
    setCopied(true);
    toast.success("Share link copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button
      variant="outline"
      size={size}
      disabled={busy}
      onClick={() => void handleClick()}
      aria-label={label}
    >
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      {size === "sm" ? (copied ? "Copied" : label) : null}
    </Button>
  );
}
