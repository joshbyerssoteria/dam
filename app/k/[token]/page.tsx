import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { NotConfigured } from "@/components/not-configured";
import { loadKitContent } from "@/lib/kit-data";
import {
  isShareUnlocked,
  resolveShare,
  shareUnlockCookieName,
} from "@/lib/share-access";
import { KitContent } from "@/components/kit-content";
import { SharePasswordForm } from "@/components/share-password-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Shared kit" };

export default async function SharedKitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = tryCreateAdminClient();
  if (!admin) return <NotConfigured />;
  const resolved = await resolveShare(admin, token);
  if (!resolved || resolved.targetType !== "kit") notFound();

  const cookieStore = await cookies();
  if (
    !isShareUnlocked(
      resolved.share,
      cookieStore.get(shareUnlockCookieName(token))?.value
    )
  ) {
    return <SharePasswordForm token={token} />;
  }

  const data = await loadKitContent(admin, resolved.kit);
  const hasFiles = data.files.length > 0 || data.fonts.some((f) => f.files.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10 flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Soteria Assets — shared kit
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {resolved.kit.name}
          </h1>
          {resolved.kit.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {resolved.kit.description}
            </p>
          ) : null}
        </div>
        {hasFiles ? (
          <Button asChild>
            <a href={`/api/share/${token}/zip`}>
              <Download className="size-4" />
              Download all
            </a>
          </Button>
        ) : null}
      </header>

      <KitContent
        data={data}
        srcPrefix={`/api/share/${token}/file`}
        shareToken={token}
      />
    </div>
  );
}
