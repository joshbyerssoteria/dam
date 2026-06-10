"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createKit } from "@/lib/actions/kits";
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
import { Textarea } from "@/components/ui/textarea";

export function NewKitDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    const result = await createKit({ name, description });
    setSaving(false);
    if (result.ok) {
      setOpen(false);
      router.push(`/kits/${result.slug}`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          New kit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New kit</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) void handleCreate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="kit-name">Name</Label>
            <Input
              id="kit-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Soteria Brand"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kit-description">Description (optional)</Label>
            <Textarea
              id="kit-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Primary brand assets — logos, palettes, type."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating…" : "Create kit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
