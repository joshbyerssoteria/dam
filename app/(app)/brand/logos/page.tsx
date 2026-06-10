import {
  BRAND,
  LOGO_COLORS,
  LOGO_DONTS,
  LOGO_LOCKUPS,
  logoPath,
} from "@/lib/brand";

export default function BrandLogosPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-14 px-8 py-12">
      {LOGO_LOCKUPS.map((lockup) => (
        <section key={lockup.type} aria-label={lockup.title}>
          <h2 className="text-sm font-semibold">{lockup.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{lockup.useFor}</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {LOGO_COLORS.map((variant) => (
              <div
                key={variant.color}
                className="overflow-hidden rounded-lg border border-border"
              >
                <div
                  className="flex aspect-[4/3] items-center justify-center p-6"
                  style={{ backgroundColor: variant.ground }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
                  <img
                    src={logoPath(lockup.type, variant.color, "svg")}
                    alt={`${lockup.title} — ${variant.label}`}
                    className={
                      lockup.type === "logomark"
                        ? "max-h-16 w-auto"
                        : "max-h-12 w-full object-contain"
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{variant.label}</p>
                    <p className="truncate text-xs text-muted-foreground" title={variant.when}>
                      {variant.when}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2 text-xs">
                    <a
                      href={logoPath(lockup.type, variant.color, "svg")}
                      download
                      className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      SVG
                    </a>
                    <a
                      href={logoPath(lockup.type, variant.color, "png")}
                      download
                      className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      PNG
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section aria-label="Favicons">
        <h2 className="text-sm font-semibold">Favicons</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          favicon-dark for light browsers, favicon-light for dark mode.
        </p>
        <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
          {(
            [
              { file: "favicon-dark", ground: BRAND.white, label: "favicon-dark" },
              { file: "favicon-light", ground: BRAND.navy, label: "favicon-light" },
            ] as const
          ).map((favicon) => (
            <div
              key={favicon.file}
              className="overflow-hidden rounded-lg border border-border"
            >
              <div
                className="flex aspect-[2/1] items-center justify-center"
                style={{ backgroundColor: favicon.ground }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
                <img
                  src={`/branding/logos/${favicon.file}.svg`}
                  alt={favicon.label}
                  className="size-10"
                />
              </div>
              <div className="flex items-center justify-between border-t border-border bg-card px-3 py-2">
                <p className="font-mono text-xs">{favicon.label}</p>
                <div className="flex gap-2 text-xs">
                  <a
                    href={`/branding/logos/${favicon.file}.svg`}
                    download
                    className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    SVG
                  </a>
                  <a
                    href={`/branding/logos/${favicon.file}.png`}
                    download
                    className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    PNG
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Clear space and minimum size" className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold">Clear space</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reserve a margin equal to the height of the logomark on all four
            sides of any lockup. Nothing sits inside that boundary.
          </p>
          <div className="mt-4 flex items-center justify-center rounded-lg border border-border bg-card p-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
            <img
              src="/branding/logos/logo-whitespace.svg"
              alt="Clear space diagram — margin equal to the logomark height on all sides"
              className="max-h-56 w-auto"
            />
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Minimum size</h2>
          <ul className="mt-1 space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Horizontal lockup:</span>{" "}
              120px wide on screen, 0.75&quot; in print.
            </li>
            <li>
              Below that, switch to the{" "}
              <span className="font-medium text-foreground">logomark</span>,
              minimum 24px.
            </li>
          </ul>
          <h2 className="mt-8 text-sm font-semibold">The mark</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The meaning behind the six-circle logomark.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
            <img
              src="/branding/logos/logo-symbology.png"
              alt="Logo symbology — the meaning of the six-circle mark"
              className="w-full"
            />
          </div>
        </div>
      </section>

      <section aria-label="Logo don'ts">
        <h2 className="text-sm font-semibold">Never</h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {LOGO_DONTS.map((rule) => (
            <li
              key={rule}
              className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
            >
              <span
                className="mr-2 font-semibold"
                style={{ color: BRAND.error }}
              >
                ✕
              </span>
              {rule}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
