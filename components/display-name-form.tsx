"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateDisplayName } from "@/lib/actions/profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DisplayNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateDisplayName(name);
    setSaving(false);
    if (result.ok) {
      toast.success("Name updated");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to update name");
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
      className="flex items-end gap-2"
    >
      <div className="flex-1 space-y-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="How your name appears to the team"
        />
      </div>
      <Button type="submit" variant="outline" disabled={saving || name === initialName}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
