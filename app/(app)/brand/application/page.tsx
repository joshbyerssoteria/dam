import { ChevronDown, Download, X } from "lucide-react";
import { APP_BUTTON_ROLES, APP_UI_PRINCIPLE, APP_UI_RULES } from "@/lib/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Application UI" };

export default function BrandApplicationPage() {
  return (
    <div>
      <PageHeader
        title="Application UI"
        description="The brand at app weight — same silhouette and palette, less shouting."
      />
      <div className="max-w-4xl space-y-14 px-8 py-10">
        <section aria-label="Principle">
          <h2 className="text-sm font-semibold">The dial, not a different brand</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {APP_UI_PRINCIPLE}
          </p>
        </section>

        <section aria-label="Buttons">
          <h2 className="text-sm font-semibold">App buttons</h2>
          <div className="mt-4 overflow-hidden border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Rest</th>
                  <th className="px-4 py-2 font-medium">Hover</th>
                  <th className="px-4 py-2 font-medium">Live</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {APP_BUTTON_ROLES.map((role) => (
                  <tr key={role.role}>
                    <td className="px-4 py-3 font-medium">{role.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">{role.rest}</td>
                    <td className="px-4 py-3 text-muted-foreground">{role.hover}</td>
                    <td className="px-4 py-3">
                      <Button variant={role.variant} size="sm">
                        {role.role === "Destructive" ? "Delete" : "Button"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border border-border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Marketing CTA — guest-facing moments only, one per screen
            </p>
            <div className="mt-3">
              <Button variant="cta">Plan Your Visit</Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              The inversion hover contract (fill → transparent + full border,
              500ms) belongs to compositions: share landings, the upload
              portal, marketing pages. Never in app chrome.
            </p>
          </div>
        </section>

        <section aria-label="Icon buttons">
          <h2 className="text-sm font-semibold">Icon buttons</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Quiet ghosts with a ≥ 32px hit area and an off-white hover. An icon
            that carries a caret becomes a pill with horizontal padding — never
            two glyphs in a fixed square.
          </p>
          <div className="mt-4 flex items-center gap-4 border border-border bg-card p-5">
            <Button variant="ghost" size="icon" aria-label="Download">
              <Download className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-auto gap-1 px-2.5"
              aria-label="Download options"
            >
              <Download className="size-4" />
              <ChevronDown className="size-3" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Remove">
              <X className="size-4" />
            </Button>
          </div>
        </section>

        <section aria-label="Inputs and chips">
          <h2 className="text-sm font-semibold">Inputs &amp; chips</h2>
          <div className="mt-4 grid gap-4 border border-border bg-card p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Field — hairline rest, gold focus
              </p>
              <Input className="mt-2" placeholder="Search photos" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Chips — square, tracked uppercase
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge>Parables</Badge>
                <Badge variant="outline">Faith</Badge>
                <Badge variant="secondary">Expired</Badge>
                <Badge variant="destructive">Revoked</Badge>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Avatar">
          <h2 className="text-sm font-semibold">Avatar</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Two-letter initials, weight 700, on a muted fill. Gold at 20% with
            navy ink is the default; solid navy with white ink is the
            alternate. Never a solid gold fill — gold stays rare.
          </p>
          <div className="mt-4 flex items-center gap-3 border border-border bg-card p-5">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#C2912D]/20 text-sm font-bold text-[#1B2A41]">
              JB
            </span>
            <span className="flex size-10 items-center justify-center rounded-full bg-[#1B2A41] text-sm font-bold text-white">
              SP
            </span>
            <span className="flex size-10 items-center justify-center rounded-full border border-[#1B2A41] bg-[#F2EEE7] text-sm font-bold text-[#1B2A41]">
              MA
            </span>
          </div>
        </section>

        <section aria-label="Rules">
          <h2 className="text-sm font-semibold">Rules</h2>
          <ul className="mt-3 space-y-2">
            {APP_UI_RULES.map((rule) => (
              <li
                key={rule}
                className="border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
              >
                {rule}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
