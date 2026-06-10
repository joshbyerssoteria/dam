import {
  BRAND,
  FONT_LOADING_SNIPPET,
  TYPE_ROLES,
  TYPE_RULES,
} from "@/lib/brand";
import { CopySnippet } from "@/components/brand/copy-chip";

export default function BrandTypographyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-14 px-8 py-12">
      <section aria-label="Typefaces">
        <h2 className="text-sm font-semibold">Two typefaces</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Inter and Lora, both free on Google Fonts. When in doubt, default to
          Inter.
        </p>

        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Inter — primary · UI, labels, body, all display
            </p>
            <p
              className="mt-4 text-4xl font-bold leading-[1.05]"
              style={{ letterSpacing: "-0.025em", color: BRAND.navy }}
            >
              Making more &amp; better disciples.
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed" style={{ color: BRAND.navy }}>
              There&apos;s a seat saved for you. We&apos;d love to meet you
              this Sunday — services at 8:30 and 10:30 AM.
            </p>
            <p
              className="mt-4 text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.2em", color: BRAND.gold }}
            >
              A refuge of truth
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lora — serif companion · wordmark, scripture, long-form, quotes
            </p>
            <p
              className="mt-4 max-w-xl text-2xl italic leading-snug"
              style={{ fontFamily: "var(--font-lora), Georgia, serif", color: BRAND.navy }}
            >
              “And this is eternal life, that they know you, the only true God,
              and Jesus Christ whom you have sent.”
            </p>
            <p
              className="mt-3 text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.2em", color: BRAND.muted }}
            >
              John 17:3
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Type roles">
        <h2 className="text-sm font-semibold">Three roles</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Weight</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium">Tracking</th>
                <th className="px-4 py-2 font-medium">Case</th>
                <th className="px-4 py-2 font-medium">Use</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {TYPE_ROLES.map((role) => (
                <tr key={role.role}>
                  <td className="px-4 py-2 font-medium">{role.role}</td>
                  <td className="px-4 py-2 font-mono text-xs">{role.weight}</td>
                  <td className="px-4 py-2 font-mono text-xs">{role.size}</td>
                  <td className="px-4 py-2 font-mono text-xs">{role.tracking}</td>
                  <td className="px-4 py-2">{role.case}</td>
                  <td className="px-4 py-2 text-muted-foreground">{role.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Hierarchy rules">
        <h2 className="text-sm font-semibold">Hierarchy rules</h2>
        <ul className="mt-3 space-y-2">
          {TYPE_RULES.map((rule) => (
            <li
              key={rule}
              className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
            >
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Loading">
        <h2 className="text-sm font-semibold">Loading</h2>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">
          Google Fonts link tag for any new web project.
        </p>
        <CopySnippet code={FONT_LOADING_SNIPPET} />
        <p className="mb-3 mt-6 text-sm text-muted-foreground">
          Fallback stacks:
        </p>
        <CopySnippet
          code={`/* Inter */
font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;

/* Lora */
font-family: 'Lora', Georgia, 'Times New Roman', serif;

/* Inter alternate characters (optional polish) */
font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';`}
        />
      </section>
    </div>
  );
}
