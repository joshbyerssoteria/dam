import type { Metadata } from "next";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { NotConfigured } from "@/components/not-configured";
import { org } from "@/lib/config";
import { isTokenLive } from "@/lib/tokens";
import { PortalUploader } from "@/components/portal-uploader";

export const metadata: Metadata = { title: "Upload photos" };

export default async function UploadPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = tryCreateAdminClient();
  if (!admin) return <NotConfigured />;

  const { data: uploadToken } = await admin
    .from("upload_tokens")
    .select("*")
    .eq("token", token)
    .single();

  const live = uploadToken !== null && isTokenLive(uploadToken.expires_at);
  const capped =
    uploadToken?.max_files != null &&
    uploadToken.used_count >= uploadToken.max_files;

  if (!uploadToken || !live || capped) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {org.appName}
          </p>
          <h1 className="mt-2 text-lg font-semibold tracking-tight">
            {capped ? "Upload limit reached" : "This upload link is no longer active"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {capped
              ? `This link has received its maximum number of files. Contact the ${org.contactTeam} if you have more to deliver.`
              : `The link may have expired or been revoked. Contact the ${org.contactTeam} for a new one.`}
          </p>
        </div>
      </div>
    );
  }

  const { data: folder } = await admin
    .from("folders")
    .select("name")
    .eq("id", uploadToken.target_folder_id)
    .single();

  const remaining =
    uploadToken.max_files != null
      ? uploadToken.max_files - uploadToken.used_count
      : null;

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col px-6 py-12">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {org.appName} — photographer upload
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {uploadToken.photographer_name
            ? `Welcome, ${uploadToken.photographer_name}`
            : "Upload your photos"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Photos upload into{" "}
          <span className="font-medium text-foreground">
            {folder?.name ?? "the event folder"}
          </span>
          {remaining !== null
            ? ` — ${remaining} file${remaining === 1 ? "" : "s"} remaining on this link`
            : ""}
          . Originals are kept at full quality.
        </p>
        {uploadToken.instructions ? (
          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Instructions
            </h2>
            <p className="mt-1.5 whitespace-pre-wrap text-sm">
              {uploadToken.instructions}
            </p>
          </div>
        ) : null}
      </header>

      <div className="mt-8">
        <PortalUploader token={token} />
      </div>
    </div>
  );
}
