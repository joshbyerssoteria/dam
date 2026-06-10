import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { revokeUploadToken } from "@/lib/actions/upload-tokens";
import { isTokenLive } from "@/lib/tokens";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { CopyLinkButton } from "@/components/copy-link-button";
import { NewUploadTokenDialog } from "@/components/new-upload-token-dialog";
import { PageHeader } from "@/components/page-header";
import { RevokeButton } from "@/components/revoke-button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Upload links" };

export default async function UploadTokensPage() {
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "admin") redirect("/photos");

  const db = await createClient();
  const [{ data: tokens }, { data: folders }] = await Promise.all([
    db.from("upload_tokens").select("*").order("created_at", { ascending: false }),
    db.from("folders").select("id, name").order("name"),
  ]);
  const tokenList = tokens ?? [];
  const folderList = folders ?? [];
  const folderNameById = new Map(folderList.map((f) => [f.id, f.name]));

  return (
    <div>
      <PageHeader
        title="Upload links"
        description="Tokenized links volunteer photographers use to deliver event coverage."
      >
        <NewUploadTokenDialog folders={folderList} />
      </PageHeader>

      <div className="p-8">
        {tokenList.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted-foreground">
            No upload links yet.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {tokenList.map((token) => {
              const live = isTokenLive(token.expires_at);
              const path = `/upload/${token.token}`;
              return (
                <div
                  key={token.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {token.photographer_name || "Unnamed photographer"}
                      </p>
                      <Badge variant="outline">
                        → {folderNameById.get(token.target_folder_id) ?? "Deleted folder"}
                      </Badge>
                      {!live ? <Badge variant="secondary">Expired</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {token.used_count}
                      {token.max_files ? ` / ${token.max_files}` : ""} uploads ·
                      created {formatDate(token.created_at)}
                      {token.expires_at && live
                        ? ` · expires ${formatDate(token.expires_at)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {live ? (
                      <>
                        <CopyLinkButton path={path} />
                        <RevokeButton
                          action={revokeUploadToken.bind(null, token.id)}
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
