import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { revokeShareLink } from "@/lib/actions/shares";
import { isTokenLive } from "@/lib/tokens";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { CopyLinkButton } from "@/components/copy-link-button";
import { PageHeader } from "@/components/page-header";
import { RevokeButton } from "@/components/revoke-button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Share links" };

export default async function SharesPage() {
  const db = await createClient();

  const { data: links } = await db
    .from("share_links")
    .select("*")
    .order("created_at", { ascending: false });
  const linkList = links ?? [];

  // Resolve target names for display.
  const kitIds = linkList
    .filter((link) => link.target_type === "kit")
    .map((link) => link.target_id);
  const folderIds = linkList
    .filter((link) => link.target_type === "folder")
    .map((link) => link.target_id);
  const [{ data: kits }, { data: folders }] = await Promise.all([
    kitIds.length > 0
      ? db.from("kits").select("id, name").in("id", kitIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    folderIds.length > 0
      ? db.from("folders").select("id, name").in("id", folderIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);
  const nameById = new Map(
    [...(kits ?? []), ...(folders ?? [])].map((row) => [row.id, row.name])
  );

  return (
    <div>
      <PageHeader
        title="Share links"
        description="Tokenized public links to kits and folders. Revoking expires the link immediately."
      />

      <div className="p-8">
        {linkList.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted-foreground">
            No share links yet. Create one from any kit or folder page.
          </p>
        ) : (
          <div className="divide-y divide-border border border-border">
            {linkList.map((link) => {
              const live = isTokenLive(link.expires_at);
              const path = `${link.target_type === "kit" ? "/k" : "/f"}/${link.token}`;
              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {nameById.get(link.target_id) ?? "Deleted target"}
                      </p>
                      <Badge variant="outline">{link.target_type}</Badge>
                      {link.password_hash ? (
                        <Lock
                          className="size-3.5 text-muted-foreground"
                          aria-label="Password protected"
                        />
                      ) : null}
                      {!live ? <Badge variant="secondary">Expired</Badge> : null}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {path}
                      <span className="ml-3 font-sans">
                        {link.download_count} download
                        {link.download_count === 1 ? "" : "s"} · created{" "}
                        {formatDate(link.created_at)}
                        {link.expires_at && live
                          ? ` · expires ${formatDate(link.expires_at)}`
                          : ""}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {live ? (
                      <>
                        <CopyLinkButton path={path} />
                        <RevokeButton
                          action={revokeShareLink.bind(null, link.id)}
                        />
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
