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

export function KitFileUpload({ kitId }: { kitId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Files
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add files to kit</DialogTitle>
        </DialogHeader>
        <UploadDropzone
          intent={{ intent: "kit-file", kitId }}
          accept="*/*"
          prompt="Drag any files here — logos, templates, documents"
        />
      </DialogContent>
    </Dialog>
  );
}
