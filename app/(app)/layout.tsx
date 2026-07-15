import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { buildNavTree } from "@/lib/nav-tree";
import { createClient, getSessionProfile } from "@/lib/supabase/server";
import { compareSermonSeriesKits } from "@/lib/utils";

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
        .select("id, slug, name, kit_folder_id, starts_on")
        .order("sort_order")
        .order("name"),
    ]);

  // Sermon-series kits order by start date (newest first), not drag order.
  // Leaves attach to the tree in array order, and only relative order within
  // a folder matters, so appending the re-sorted sermon kits is enough.
  const sermonFolderIds = new Set(
    (kitFolders ?? [])
      .filter((folder) => folder.kind === "sermon_series")
      .map((folder) => folder.id)
  );
  const inSermonSeries = (kit: { kit_folder_id: string | null }) =>
    kit.kit_folder_id !== null && sermonFolderIds.has(kit.kit_folder_id);
  const kitList = [
    ...(kits ?? []).filter((kit) => !inSermonSeries(kit)),
    ...(kits ?? []).filter(inSermonSeries).sort(compareSermonSeriesKits),
  ];

  const photoTree = buildNavTree(folders ?? [], (id) => `/photos/${id}`);
  const projectTree = buildNavTree(
    projects ?? [],
    (id) => `/photos/projects/${id}`
  );
  const kitTree = buildNavTree(
    kitFolders ?? [],
    (id) => `/kits/f/${id}`,
    kitList.map((kit) => ({
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
