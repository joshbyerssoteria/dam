"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small click-to-copy chip for hex values, tokens, and snippets. */
export function CopyChip({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      title={`Copy ${value}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : (label ?? value)}
    </button>
  );
}

/** Copy button for multi-line code snippets. */
export function CopySnippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto border border-border bg-muted/50 p-4 font-mono text-xs leading-relaxed">
        {code}
      </pre>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label="Copy snippet"
        className="absolute right-2 top-2 rounded-md border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
