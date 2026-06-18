import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { buildNavTree } from "@/lib/nav-tree";
import { createClient, getSessionProfile } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const db = await createClient();
  const [{ data: folders }, { data: projects }, { data: kitFolders }, { data: kits }] =
    await Promise.all([
      db.from("folders").select("id, name, parent_id, sort_order"),
      db.from("projects").select("id, name, parent_id, sort_order"),
      db.from("kit_folders").select("id, name, parent_id, sort_order, kind"),
      db
        .from("kits")
        .select("id, slug, name, kit_folder_id")
        .order("sort_order")
        .order("name"),
    ]);

  const photoTree = buildNavTree(folders ?? [], (id) => `/photos/${id}`);
  const projectTree = buildNavTree(
    projects ?? [],
    (id) => `/photos/projects/${id}`
  );
  const kitTree = buildNavTree(
    kitFolders ?? [],
    (id) => `/kits/f/${id}`,
    (kits ?? []).map((kit) => ({
      id: kit.id,
      name: kit.name,
      parentId: kit.kit_folder_id,
      href: `/kits/${kit.slug}`,
    }))
  );

  return (
    <div className="flex min-h-svh">
      <AppSidebar
        role={session.profile.role}
        email={session.profile.email}
        displayName={session.profile.display_name}
        photoTree={photoTree}
        projectTree={projectTree}
        kitTree={kitTree}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
