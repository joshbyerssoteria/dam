"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateUserRole } from "@/lib/actions/profiles";
import type { AppRole } from "@/lib/database.types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: AppRole;
  disabled: boolean;
}) {
  const router = useRouter();

  async function handleChange(nextRole: string) {
    const result = await updateUserRole(userId, nextRole as AppRole);
    if (result.ok) {
      toast.success("Role updated");
      router.refresh();
    } else {
      toast.error(result.error ?? "Failed to update role");
    }
  }

  return (
    <Select value={role} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className="w-28" aria-label="Role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">admin</SelectItem>
        <SelectItem value="editor">editor</SelectItem>
        <SelectItem value="viewer">viewer</SelectItem>
      </SelectContent>
    </Select>
  );
}
