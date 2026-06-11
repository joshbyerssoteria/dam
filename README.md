# Soteria DAM

Custom Digital Asset Management for Soteria Church — replaces Lingo (brand
kits) and Zenfolio (photo archive). See [SPEC.md](SPEC.md) for the full spec;
it is the source of truth.

**Deploying this for another church?** The app is packaged as a white-label,
single-tenant deployment kit: run `npm run setup` and follow
[docs/SELF_HOSTING.md](docs/SELF_HOSTING.md). Strategy background in
[docs/PACKAGING.md](docs/PACKAGING.md).

## Stack

Next.js 15 (App Router, TypeScript strict) · Supabase (Postgres + Auth +
pgvector) · AWS S3 · sharp · Inngest · Claude vision (tagging) · OpenAI
embeddings (semantic search) · shadcn/ui + Tailwind v4.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev                  # http://localhost:3000
```

### Required environment

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — **required** for public share pages and the
  photographer upload portal (they validate tokens in app code and bypass RLS)
- `DATABASE_URL` — use the **session pooler** URL
  (`aws-1-<region>.pooler.supabase.com:5432`, user `postgres.<project-ref>`);
  the direct `db.*` host is IPv6-only and unreachable from most home/office
  networks

### Optional environment (features degrade gracefully without them)

- `ANTHROPIC_API_KEY` — AI tagging of uploaded photos (skipped if unset)
- `OPENAI_API_KEY` — semantic search embeddings (keyword-only search if unset)
- `AWS_*` + `S3_BUCKET_NAME` — S3 storage; **without it, files are stored on
  local disk under `.uploads/`** (dev only — fine for beta testing, not for
  Vercel production)
- `INNGEST_*` — background job delivery in production; in dev run
  `npx inngest-cli@latest dev` alongside `npm run dev`
- `RESEND_API_KEY` — reserved for v2 email notifications

### Database

Migrations live in `supabase/migrations/` and are applied with:

```bash
npx supabase db push --db-url "$DATABASE_URL"
```

The initial migration creates the full schema, RLS policies, the
`search_photos` hybrid-search function, and seeds the Soteria space.

### First sign-in

Auth is magic-link via Supabase. **The first account to sign up becomes
admin** (database trigger); everyone after starts as `viewer` and is promoted
from Settings → Team.

In local dev, magic-link emails are sent by Supabase's built-in service —
configure `http://localhost:3000/auth/callback` as an allowed redirect URL in
the Supabase dashboard (Authentication → URL Configuration).

## Commands

```bash
npm run dev / build / start
npm run lint
npm run typecheck
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright (needs env configured; starts dev server)
```

## What's in the beta (v1)

- Photo library: nested folders, drag-drop multi-upload with progress,
  responsive gallery, lightbox with AI metadata sidebar, original download
- AI pipeline: Claude vision tags/caption/scene/event-type + pgvector
  embedding, via Inngest with retries
- Hybrid search: 70/30 semantic/keyword at `/api/search`, search page UI
- Kits: files, color palettes (click-to-copy hex swatches), fonts with files
- Sharing: tokenized links for kits (`/k/[token]`) and folders
  (`/f/[token]`), optional bcrypt password + expiry, zip download-all,
  download audit log
- Photographer portal at `/upload/[token]` with instructions, per-file
  progress, max-files cap, and confirmation screen
- Roles: admin / editor / viewer enforced by RLS; team management in Settings

### Known beta deviations from the spec

- **Uploads are direct POST (with per-file progress), not tus-resumable.**
  `@tus/server` only ships a Node `http` handler that doesn't fit App Router
  routes cleanly, and its disk store doesn't survive serverless invocations.
  Resumable uploads are the first production-hardening task (tus or S3
  multipart presigned).
- **Image variants are served by an authenticated `sharp` route**
  (`/api/files/[id]?w=`), not Next `<Image>` optimization — the optimizer
  cannot forward auth cookies. Revisit if/when originals live on public-read
  S3 or behind a CDN.
- Direct uploads are capped at 50 MB/file; on Vercel the platform body limit
  applies — large originals need the S3 presigned path (planned with tus).
