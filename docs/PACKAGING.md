# Packaging Strategy — Soteria DAM for Other Churches

Status: **adopted** (June 2026). This document records the decision and the
reasoning; `docs/SELF_HOSTING.md` is the operational guide that implements it.

## Goal

Let other churches run this DAM for their own brand assets and photo archives,
without compromising Soteria's deployment, without taking on SaaS-operator
obligations the team is not staffed for, and without conflating this with the
explicit v1 non-goal of in-app multi-tenancy.

## Options considered

### A. Multi-tenant SaaS (one hosted deployment, many churches)

One Vercel + Supabase deployment serves every church; tenancy via the existing
`spaces` table; billing, onboarding, and subdomain routing built in-app.

- **For:** lowest marginal cost per church; one codebase to update; the schema
  is already space-scoped (`spaces`, `space_id` FKs, space-aware RLS), so the
  data layer is partway there.
- **Against:** everything *around* the data layer is single-tenant — auth has
  no space membership concept, S3 is one bucket with one IAM identity, AI
  spend (Claude vision + OpenAI embeddings) lands on one API key with no
  per-tenant metering, and Inngest/Resend are single-app. Add billing, tenant
  isolation review, uptime expectations, and support, and this is a product
  company's workload, not a church comms team's. It is also an explicit v1
  non-goal in `SPEC.md`.

### B. Single-tenant deployment kit (one church = one deployment) — **chosen**

Each church deploys its own instance from this repo: its own Vercel project,
Supabase project, S3 bucket, and AI/Inngest keys. The repo becomes a template;
a config layer carries the church's identity and a setup wizard provisions
`.env.local`.

- **For:** total data isolation by construction (separate databases, buckets,
  auth user pools — nothing to audit); zero billing infrastructure (each
  church pays its own Vercel/Supabase/AWS/Anthropic/OpenAI bills directly,
  which also gives perfect AI-cost attribution); failure isolation (one
  church's outage or quota exhaustion touches no one else); the free tiers of
  the whole stack comfortably fit a single church's volume, so a small church
  can run this for roughly the cost of S3 storage alone. This is the standard
  packaging pattern for open-source Vercel+Supabase apps (Documenso, Papermark,
  the official Vercel/Supabase starter flow, where the deploy flow clones the
  repo and the Supabase integration runs checked-in migrations).
- **Against:** updates ship by pulling from the template repo (no central
  deploy); each church needs one technically-comfortable person (or us, see C)
  for the initial ~30-minute setup; N instances means N places to apply a
  security fix.

### C. Managed single-tenant ("we host it for you")

Operationally a variant of B: same per-church instances, but Soteria (or a
spun-out entity) owns the Vercel/Supabase/AWS accounts and charges churches a
flat fee. No code differences from B — it is a business decision that can be
made later, per church.

## Decision

**Option B, built so A stays open.** Concretely:

1. **White-label config layer** (`lib/config.ts`): every org-identifying
   string — app name, church name, contact-team wording, login placeholder,
   logo path — reads from `NEXT_PUBLIC_*` env vars with Soteria defaults, so
   Soteria's production deployment needs no env changes and a fork is rebranded
   entirely from env.
2. **Brand pack separation:** the Brand Guide section (`/brand`, `lib/brand.ts`,
   `public/branding/`) is Soteria *content*, not app code. It is gated by
   `NEXT_PUBLIC_BRAND_GUIDE` (default on); a new church deploys with it off
   until they replace the brand pack with their own. Their kit/palette/font
   data — the Lingo-replacement core — works regardless.
3. **Configurable AI event types:** `NEXT_PUBLIC_EVENT_TYPES` overrides the
   default ministry taxonomy used by the tagging prompt and photo filters,
   since "kids_ministry / students / men / women" is a Soteria org-chart, not
   a universal one.
4. **Setup wizard** (`npm run setup`): interactive script that collects the
   church's identity + service credentials, writes `.env.local`, optionally
   verifies Supabase/S3 connectivity, and renames the seeded space. First
   sign-in still auto-promotes to admin (existing DB trigger), so there is no
   manual user bootstrap.
5. **Deployment guide** (`docs/SELF_HOSTING.md`): the end-to-end runbook a new
   church follows — accounts to create, wizard, `supabase db push`, Vercel
   env, S3 CORS.
6. **Keep the `spaces` architecture intact.** All new code must continue to
   scope by `space_id`. If demand ever justifies a hosted multi-tenant product
   (option A), the data layer migration is additive, not a rewrite.

## Distribution model

- The repo is shared as a **GitHub template** (or plain fork). Churches click
  "Use this template", run `npm run setup`, and follow `docs/SELF_HOSTING.md`.
- Updates: churches pull from upstream. Because customization lives in env
  vars and the replaceable brand pack (not in edited app code), merges stay
  clean.
- Out of scope for now, possible later: a Vercel Deploy Button with the
  Supabase integration (runs `supabase/migrations` automatically on first
  deploy), and a hosted "managed" tier (option C).

## Roadmap

| Phase | Scope |
|---|---|
| 1 (this change) | Config layer, brand-guide gate, event-type config, setup wizard, self-hosting guide |
| 2 | Brand pack as data: replace `lib/brand.ts` with DB-backed brand guide content editable in-app; logo upload in settings |
| 3 (only if demand) | Hosted multi-tenant on the existing `spaces` schema: space membership in auth, per-space S3 prefixes, metered AI usage |

## Sources

Patterns referenced during research:

- [Deploying Documenso with Vercel, Supabase and Resend](https://documenso.com/blog/deploy-with-vercel-supabase-resend)
- [Supabase & Next.js starter / Deploy Button flow](https://vercel.com/templates/next.js/supabase)
- [Supabase + Vercel integration (env + auth redirect automation)](https://supabase.com/blog/using-supabase-with-vercel)
- [Single-tenant vs multi-tenant trade-offs (WorkOS)](https://workos.com/blog/singletenant-vs-multitenant)
- [Multi-tenant vs single-tenant architecture comparison (Clerk)](https://clerk.com/blog/multi-tenant-vs-single-tenant)
