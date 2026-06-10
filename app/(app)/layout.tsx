import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { getSessionProfile } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-svh">
      <AppSidebar role={session.profile.role} email={session.profile.email} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
