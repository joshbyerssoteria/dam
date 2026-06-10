"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { unlockShare } from "@/lib/actions/share-unlock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SharePasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await unlockShare(token, password);
    setBusy(false);
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error ?? "Something went wrong");
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="text-lg font-semibold tracking-tight">
          Password required
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This shared collection is protected.
        </p>
        <div className="mt-6 space-y-2">
          <Label htmlFor="share-password">Password</Label>
          <Input
            id="share-password"
            type="password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        ) : null}
        <Button
          type="submit"
          className="mt-4 w-full"
          disabled={busy || password.length === 0}
        >
          {busy ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </div>
  );
}
