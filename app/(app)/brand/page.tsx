import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  BRAND,
  BRAND_COLORS,
  BRAND_SUMMARY,
  IDENTITY,
} from "@/lib/brand";

const SECTIONS = [
  {
    href: "/brand/logos",
    title: "Logos",
    body: "Four lockups in four colors, with clear-space and minimum-size rules.",
  },
  {
    href: "/brand/colors",
    title: "Colors",
    body: "Four colors, no more. The ratio, the rules, click-to-copy values.",
  },
  {
    href: "/brand/typography",
    title: "Typography",
    body: "Inter and Lora — three roles, hierarchy rules, loading snippets.",
  },
  {
    href: "/brand/guidelines",
    title: "Guidelines",
    body: "Voice, layout, accessibility, and the mistakes to avoid.",
  },
  {
    href: "/brand/examples",
    title: "Examples",
    body: "Photography treatments in action and the curated photo library.",
  },
] as const;

export default function BrandOverviewPage() {
  return (
    <div>
      {/* Hero on navy — the brand presenting itself */}
      <div style={{ backgroundColor: BRAND.navy }}>
        <div className="mx-auto max-w-4xl px-8 py-20">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
          <img
            src="/branding/logos/horizontal-white.svg"
            alt="Soteria Church"
            className="h-12 w-auto"
          />
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/90">
            {BRAND_SUMMARY}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {BRAND_COLORS.map((color) => (
              <span
                key={color.id}
                className="size-8 rounded-full border border-white/20"
                style={{ backgroundColor: color.hex }}
                title={`${color.name} ${color.hex}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-12 px-8 py-12">
        <section aria-label="Identity">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Identity
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-12 gap-y-3 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{IDENTITY.name}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium">{IDENTITY.type}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="font-medium">{IDENTITY.location}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Services</dt>
              <dd className="font-medium">{IDENTITY.serviceTimes}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Mission</dt>
              <dd className="font-medium">“{IDENTITY.tagline}”</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Four pillars</dt>
              <dd className="text-right font-medium">
                {IDENTITY.pillars.join(" · ")}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-label="Sections">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-muted-foreground/40"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{section.title}</h3>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {section.body}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
