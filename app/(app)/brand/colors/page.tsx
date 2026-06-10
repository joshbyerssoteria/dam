import {
  BRAND_COLORS,
  COLOR_RULES,
  CONTRAST_TABLE,
  CSS_VARIABLES_SNIPPET,
  SUPPORTING_COLORS,
} from "@/lib/brand";
import { CopyChip, CopySnippet } from "@/components/brand/copy-chip";
import { PageHeader } from "@/components/page-header";

export default function BrandColorsPage() {
  return (
    <div>
      <PageHeader title="Colors" />
      <div className="max-w-4xl space-y-14 px-8 py-10">
      <section aria-label="Brand colors">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BRAND_COLORS.map((color) => (
            <div
              key={color.id}
              className="overflow-hidden rounded-lg border border-border"
            >
              <div
                className="h-24"
                style={{
                  backgroundColor: color.hex,
                  ...(color.id === "white"
                    ? { borderBottom: "1px solid var(--border)" }
                    : {}),
                }}
              />
              <div className="space-y-2 bg-card p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">{color.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    ~{color.share}% of any composition
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{color.role}</p>
                <div className="flex flex-wrap gap-1.5">
                  <CopyChip value={color.hex} />
                  <CopyChip value={`rgb(${color.rgb})`} label={color.rgb} />
                  <CopyChip value={`var(--${color.id})`} label={`--${color.id}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="The ratio">
        <h2 className="text-sm font-semibold">The ratio</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          White dominates; gold punctuates. Hold these proportions in any
          composition.
        </p>
        <div className="mt-4 flex h-10 w-full overflow-hidden rounded-lg border border-border">
          {[...BRAND_COLORS]
            .sort((a, b) => b.share - a.share)
            .map((color) => (
              <div
                key={color.id}
                style={{
                  width: `${color.share}%`,
                  backgroundColor: color.hex,
                }}
                title={`${color.name} ~${color.share}%`}
              />
            ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {[...BRAND_COLORS]
            .sort((a, b) => b.share - a.share)
            .map((color) => (
              <span key={color.id}>
                {color.name} ~{color.share}%
              </span>
            ))}
        </div>
      </section>

      <section aria-label="Supporting colors">
        <h2 className="text-sm font-semibold">Supporting (functional, not brand)</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SUPPORTING_COLORS.map((color) => (
            <div
              key={color.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <span
                className="size-10 shrink-0 rounded-md border border-black/5"
                style={{ backgroundColor: color.hex }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{color.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {color.role}
                </p>
                <CopyChip value={color.hex} className="mt-1" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Rules">
        <h2 className="text-sm font-semibold">Rules</h2>
        <ol className="mt-3 space-y-2">
          {COLOR_RULES.map((rule, index) => (
            <li
              key={index}
              className="flex gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {index + 1}
              </span>
              <span className="text-muted-foreground">{rule}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Contrast">
        <h2 className="text-sm font-semibold">Contrast (WCAG AA)</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium">Pair</th>
                <th className="px-4 py-2 font-medium">Ratio</th>
                <th className="px-4 py-2 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {CONTRAST_TABLE.map((row) => (
                <tr key={row.pair}>
                  <td className="px-4 py-2">{row.pair}</td>
                  <td className="px-4 py-2 font-mono text-xs">{row.ratio}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="CSS variables">
        <h2 className="text-sm font-semibold">CSS variable starter</h2>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">
          Drop into the global CSS of any new Soteria project.
        </p>
        <CopySnippet code={CSS_VARIABLES_SNIPPET} />
      </section>
      </div>
    </div>
  );
}
