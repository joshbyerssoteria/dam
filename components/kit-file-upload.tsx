"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UploadDropzone } from "@/components/upload-dropzone";

/**
 * Upload files into a kit. Without sectionId files land unsectioned
 * (header button); with sectionId they go straight into that section
 * (compact per-section button).
 */
export function KitFileUpload({
  kitId,
  sectionId,
  sectionName,
  variant = "header",
}: {
  kitId: string;
  sectionId?: string;
  sectionName?: string;
  variant?: "header" | "section";
}) {
  const [open, setOpen] = useState(false);

  const intent =
    sectionId !== undefined
      ? ({ intent: "kit-file", kitId, sectionId } as const)
      : ({ intent: "kit-file", kitId } as const);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "header" ? (
          <Button variant="outline" size="sm">
            <Plus className="size-4" />
            Files
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            aria-label={`Add files to ${sectionName ?? "section"}`}
          >
            <Plus className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {sectionName ? `Add files to ${sectionName}` : "Add files to kit"}
          </DialogTitle>
        </DialogHeader>
        <UploadDropzone
          intent={intent}
          accept="*/*"
          prompt="Drag any files here — logos, templates, documents"
        />
      </DialogContent>
    </Dialog>
  );
}
