import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { DisplayNameForm } from "@/components/display-name-form";
import { PageHeader } from "@/components/page-header";
import { RoleSelect } from "@/components/role-select";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const isAdmin = session.profile.role === "admin";
  const db = await createClient();
  const { data: profiles } = isAdmin
    ? await db.from("profiles").select("*").order("created_at")
    : { data: null };

  return (
    <div>
      <PageHeader
        title="Profile & settings"
        description="Your account and team access."
      />

      <div className="space-y-12 p-8">
        <section aria-labelledby="settings-account" className="max-w-lg">
          <h2
            id="settings-account"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Account
          </h2>
          <div className="mt-4 space-y-5 rounded-lg border border-border bg-card p-5">
            <DisplayNameForm initialName={session.profile.display_name ?? ""} />
            <dl className="space-y-3 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd>{session.profile.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Role</dt>
                <dd>
                  <Badge variant="outline">{session.profile.role}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Member since</dt>
                <dd>{formatDate(session.profile.created_at)}</dd>
              </div>
            </dl>
          </div>
        </section>

        {isAdmin ? (
          <section aria-labelledby="settings-team">
            <h2
              id="settings-team"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Team
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              New sign-ins start as viewers. Grant editor to people who upload
              and organize; admin manages users and tokens.
            </p>
            <div className="mt-4 max-w-2xl divide-y divide-border rounded-lg border border-border">
              {(profiles ?? []).map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {profile.display_name || profile.email}
                    </p>
                    {profile.display_name ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {profile.email}
                      </p>
                    ) : null}
                  </div>
                  <RoleSelect
                    userId={profile.id}
                    role={profile.role}
                    disabled={profile.id === session.userId}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
