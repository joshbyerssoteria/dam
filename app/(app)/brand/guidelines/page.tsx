import {
  BRAND,
  COMMON_MISTAKES,
  LAYOUT_PRINCIPLES,
  VOICE,
} from "@/lib/brand";

export default function BrandGuidelinesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-14 px-8 py-12">
      <section aria-label="Voice">
        <h2 className="text-sm font-semibold">Voice</h2>
        <p className="mt-1 text-sm text-muted-foreground">{VOICE.summary}</p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3
              className="text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.18em", color: BRAND.gold }}
            >
              We are
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {VOICE.weAre.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3
              className="text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.18em", color: BRAND.error }}
            >
              We are not
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {VOICE.weAreNot.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-label="Headlines">
        <h2 className="text-sm font-semibold">Headlines</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              These work
            </h3>
            <ul className="mt-3 space-y-2.5">
              {VOICE.headlinesThatWork.map((headline) => (
                <li
                  key={headline}
                  className="text-base font-semibold leading-snug"
                  style={{ color: BRAND.navy }}
                >
                  {headline}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              These don&apos;t
            </h3>
            <ul className="mt-3 space-y-2.5">
              {VOICE.headlinesThatDont.map((headline) => (
                <li key={headline.text} className="text-sm">
                  <span className="text-muted-foreground line-through">
                    {headline.text}
                  </span>
                  <span
                    className="ml-2 text-xs"
                    style={{ color: BRAND.error }}
                  >
                    {headline.why}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-label="Writing specifics">
        <h2 className="text-sm font-semibold">Specifics</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <dt className="font-medium">Service times</dt>
            <dd className="mt-0.5 text-muted-foreground">
              “Sundays at 8:30 and 10:30 AM.” Always both. No ampersand in body
              copy; fine in tracked uppercase eyebrows.
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <dt className="font-medium">Scripture references</dt>
            <dd className="mt-0.5 text-muted-foreground">
              “JOHN 17:3” when small or eyebrow-style. “John 17:3” in running
              body copy.
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <dt className="font-medium">Pastor reference</dt>
            <dd className="mt-0.5 text-muted-foreground">
              First mention “Dr. Mike Augsburger” or “Pastor Mike.” After that,
              “Mike” is fine.
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <dt className="font-medium">Address</dt>
            <dd className="mt-0.5 text-muted-foreground">
              West Des Moines, Iowa. Never “IA” in body copy; OK in tight
              labels.
            </dd>
          </div>
        </dl>
      </section>

      <section aria-label="Layout">
        <h2 className="text-sm font-semibold">Layout</h2>
        <div className="mt-3 space-y-2">
          {LAYOUT_PRINCIPLES.map((principle) => (
            <div
              key={principle.title}
              className="rounded-lg border border-border bg-card px-4 py-3"
            >
              <h3 className="text-sm font-medium">{principle.title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {principle.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Common mistakes">
        <h2 className="text-sm font-semibold">Common mistakes to avoid</h2>
        <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {COMMON_MISTAKES.map((mistake, index) => (
            <li
              key={mistake}
              className="flex gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
            >
              <span className="font-mono text-xs text-muted-foreground/60">
                {String(index + 1).padStart(2, "0")}
              </span>
              {mistake}
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Full guidelines">
        <p className="text-sm text-muted-foreground">
          The complete written system — including component specs, motion, and
          accessibility details — lives in{" "}
          <span className="font-mono text-xs">branding/brand-guidelines.md</span>{" "}
          in the repo, the source of truth for any new Soteria project.
        </p>
      </section>
    </div>
  );
}
