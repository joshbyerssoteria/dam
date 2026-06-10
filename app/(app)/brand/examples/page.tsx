import { readdir } from "fs/promises";
import path from "path";
import { BRAND, PHOTO_RULES, PHOTO_TREATMENTS } from "@/lib/brand";

export const dynamic = "force-dynamic";

/* Treatment demos use real photos from the curated library. */
const DEMO_PHOTOS = {
  untreated: "/branding/photos/staff-mike-1.jpg",
  gradient: "/branding/photos/lrp-260.jpg",
  wash: "/branding/photos/baptism-141.jpg",
  card: "/branding/photos/greetings.jpg",
} as const;

async function listBrandPhotos(): Promise<string[]> {
  try {
    const files = await readdir(
      path.join(process.cwd(), "public", "branding", "photos")
    );
    return files
      .filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
      .sort();
  } catch {
    return [];
  }
}

export default async function BrandExamplesPage() {
  const photos = await listBrandPhotos();

  return (
    <div className="mx-auto max-w-5xl space-y-14 px-8 py-12">
      <section aria-label="Photography principle">
        <h2 className="text-sm font-semibold">Photography</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          When a photo is in a layout, the photo is the message. Type, color,
          and graphic elements are supporting cast — not competing
          personalities. Four treatments cover every use.
        </p>
      </section>

      <section aria-label="Treatments">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Untreated */}
          <figure className="overflow-hidden rounded-lg border border-border">
            <div className="relative aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
              <img
                src={DEMO_PHOTOS.untreated}
                alt="Untreated portrait example"
                className="size-full object-cover"
              />
            </div>
            <figcaption className="border-t border-border bg-card px-4 py-3">
              <p className="text-sm font-medium">{PHOTO_TREATMENTS[0].name}</p>
              <p className="text-xs text-muted-foreground">
                {PHOTO_TREATMENTS[0].when}
              </p>
            </figcaption>
          </figure>

          {/* Bottom gradient */}
          <figure className="overflow-hidden rounded-lg border border-border">
            <div className="relative aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
              <img
                src={DEMO_PHOTOS.gradient}
                alt="Bottom gradient treatment example"
                className="size-full object-cover"
              />
              <div
                className="absolute inset-x-0 bottom-0 h-2/3"
                style={{
                  background: `linear-gradient(to top, ${BRAND.navy}E6, transparent)`,
                }}
              />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p
                  className="text-[10px] font-bold uppercase"
                  style={{ letterSpacing: "0.2em", color: BRAND.gold }}
                >
                  Sundays at 8:30 and 10:30 AM
                </p>
                <p
                  className="mt-1 text-2xl font-bold leading-tight text-white"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  There&apos;s a seat saved for you.
                </p>
              </div>
            </div>
            <figcaption className="border-t border-border bg-card px-4 py-3">
              <p className="text-sm font-medium">{PHOTO_TREATMENTS[1].name}</p>
              <p className="text-xs text-muted-foreground">
                {PHOTO_TREATMENTS[1].when}
              </p>
            </figcaption>
          </figure>

          {/* Full navy wash */}
          <figure className="overflow-hidden rounded-lg border border-border">
            <div className="relative aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
              <img
                src={DEMO_PHOTOS.wash}
                alt="Full navy wash treatment example"
                className="size-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ backgroundColor: `${BRAND.navy}99` }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <p
                  className="max-w-xs text-xl font-bold leading-snug text-white"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Every word of the Bible is true.
                </p>
                <span
                  className="mt-3 h-px w-10"
                  style={{ backgroundColor: BRAND.gold }}
                />
              </div>
            </div>
            <figcaption className="border-t border-border bg-card px-4 py-3">
              <p className="text-sm font-medium">{PHOTO_TREATMENTS[2].name}</p>
              <p className="text-xs text-muted-foreground">
                {PHOTO_TREATMENTS[2].when}
              </p>
            </figcaption>
          </figure>

          {/* Photo + card */}
          <figure className="overflow-hidden rounded-lg border border-border">
            <div
              className="flex aspect-[4/3] items-center justify-center p-6"
              style={{ backgroundColor: BRAND.offwhite }}
            >
              <div className="w-full max-w-[85%]">
                {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
                <img
                  src={DEMO_PHOTOS.card}
                  alt="Photo inside card treatment example"
                  className="aspect-[16/10] w-full object-cover"
                />
                <p
                  className="mt-3 text-sm font-semibold"
                  style={{ color: BRAND.navy }}
                >
                  Come as you are.
                </p>
                <p className="text-xs" style={{ color: BRAND.muted }}>
                  Growth Groups meet across the metro every week.
                </p>
              </div>
            </div>
            <figcaption className="border-t border-border bg-card px-4 py-3">
              <p className="text-sm font-medium">{PHOTO_TREATMENTS[3].name}</p>
              <p className="text-xs text-muted-foreground">
                {PHOTO_TREATMENTS[3].when}
              </p>
            </figcaption>
          </figure>
        </div>
      </section>

      <section aria-label="Photography rules">
        <h2 className="text-sm font-semibold">Rules</h2>
        <ul className="mt-3 space-y-2">
          {PHOTO_RULES.map((rule) => (
            <li
              key={rule}
              className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
            >
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Curated photo library">
        <h2 className="text-sm font-semibold">The curated set</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {photos.length} brand-quality photos — worship, baptism, kids,
          Sunday services, staff portraits, events. Right-click to save, or
          find originals in the photo library.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <a
              key={photo}
              href={`/branding/photos/${photo}`}
              target="_blank"
              rel="noreferrer"
              className="group relative aspect-square overflow-hidden bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
              <img
                src={`/branding/photos/${photo}`}
                alt={photo.replace(/\.[^.]+$/, "").replace(/-/g, " ")}
                loading="lazy"
                className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
