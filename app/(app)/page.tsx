import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Image as ImageIcon,
  Palette,
  Search as SearchIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { org } from "@/lib/config";
import { createClient, getSessionProfile } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home" };

function greetingFor(hour: number) {
  if (hour < 5) return "Welcome back";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function HomeCard({
  href,
  icon: Icon,
  title,
  description,
  detail,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group border border-border p-5 transition-colors hover:border-[var(--gold)]/50 hover:bg-accent/40"
    >
      <div className="flex items-center justify-between">
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} />
        <ArrowRight
          className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={1.75}
        />
      </div>
      <h2 className="mt-4 text-sm font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </Link>
  );
}

export default async function HomePage() {
  const session = await getSessionProfile();
  const db = await createClient();

  const [
    { count: photoCount },
    { count: folderCount },
    { count: kitCount },
    { data: recentPhotos },
  ] = await Promise.all([
    db.from("photos").select("id", { count: "exact", head: true }),
    db.from("folders").select("id", { count: "exact", head: true }),
    db.from("kits").select("id", { count: "exact", head: true }),
    db
      .from("photos")
      .select("id, file_id, folder_id, ai_caption")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const now = new Date();
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: org.timezone,
      hour: "numeric",
      hour12: false,
    }).format(now)
  );
  const dateLine = new Intl.DateTimeFormat("en-US", {
    timeZone: org.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  const displayName = session?.profile.display_name?.trim();
  const firstName = displayName
    ? displayName.split(/\s+/)[0]
    : session?.profile.email.split("@")[0];

  return (
    <div className="mx-auto max-w-5xl px-8 py-14">
      <p className="text-sm text-muted-foreground">{dateLine}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        {greetingFor(hour)}
        {firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        {org.appName} is {org.name}&rsquo;s home for photos and brand assets —
        find it, share it, keep it consistent.
      </p>
      <div className="mt-6 h-px w-12 bg-[var(--gold)]" aria-hidden />

      <form action="/search" className="relative mt-10 max-w-xl">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          placeholder="Search photos — try &ldquo;hands raised in worship&rdquo;"
          aria-label="Search photos"
          className="h-11 pl-9"
        />
      </form>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HomeCard
          href="/photos"
          icon={ImageIcon}
          title="Photos"
          description="The event archive — AI-tagged, searchable, ready to share."
          detail={`${(photoCount ?? 0).toLocaleString()} photos · ${(folderCount ?? 0).toLocaleString()} folders`}
        />
        <HomeCard
          href="/kits"
          icon={Palette}
          title="Kits"
          description="Logos, color palettes, fonts, and templates by ministry."
          detail={`${(kitCount ?? 0).toLocaleString()} kits`}
        />
        {org.brandGuideEnabled ? (
          <HomeCard
            href="/brand"
            icon={BookOpen}
            title="Brand Guide"
            description="Colors, typography, logo usage — the rules of the road."
            detail="How we look and sound"
          />
        ) : null}
      </div>

      {recentPhotos && recentPhotos.length > 0 ? (
        <section className="mt-16">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium">Recently added</h2>
            <Link
              href="/photos"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Browse all photos
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-6">
            {recentPhotos.map((photo) => (
              <Link
                key={photo.id}
                href={`/photos/${photo.folder_id}`}
                className="group relative aspect-square overflow-hidden bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route */}
                <img
                  src={`/api/files/${photo.file_id}?w=480`}
                  alt={photo.ai_caption ?? "Recently added photo"}
                  loading="lazy"
                  draggable={false}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
