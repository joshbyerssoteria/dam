# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Soteria DAM — a custom Digital Asset Management app for Soteria (a multi-site church in West Des Moines, Iowa). It replaces two SaaS tools: **Lingo** (brand assets — logos, palettes, fonts, templates, organized into "Kits") and **Zenfolio** (photo galleries in a folder/gallery hierarchy).

**`SPEC.md` is the source of truth.** Read it before making architectural decisions. When an implementation decision changes something in the spec, update `SPEC.md` in the same change.

Audience: 20–30 internal users (2–5 daily power users), an external marketing agency, volunteer photographers (upload-only via tokenized links), and a comms director.

## Commands

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build        # Production build
npm run start        # Serve production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (strict)
npm run test         # Vitest (unit)
npm run test -- path/to/file.test.ts   # single test file
npm run test:e2e     # Playwright (critical flows)

# Database (Supabase CLI)
npx supabase migration new <name>   # create a new migration
npx supabase db push                # apply migrations to the linked project
npx supabase db reset               # reset local db and re-run all migrations + seed
```

## Architecture

Two **parallel trees** that must never be conflated in code or schema — they are different mental models:

- **Kits** (brand asset side, replaces Lingo): `kits` → `kit_assets` (polymorphic to `files` | `palettes` | `fonts`). Palettes own `colors`; fonts own `font_files`.
- **Folders** (photo side, replaces Zenfolio): arbitrarily nested `folders` → `photos` (each wraps a `files` row and carries AI metadata + a `vector(1536)` embedding).

Shared infrastructure: `files` (S3-backed blobs), `share_links`, `upload_tokens`, and audit logs (`download_log`, `upload_log`). Users come from Supabase Auth, extended with a `role` of `admin | editor | viewer`.

### Key flows

- **AI tagging pipeline:** on photo upload, an Inngest job fetches a small image variant, sends it to Claude vision with a structured JSON prompt (`tags`, `scene`, `caption`, `event_type`), embeds the `caption` with OpenAI `text-embedding-3-small` (1536-dim), and stores all fields on the photo row. See `SPEC.md` → Implementation Notes for the exact prompt.
- **Hybrid search** (`/api/search?q=...`): embed the query, then run a single Postgres query combining vector cosine similarity on `photos.embedding` with keyword overlap on `photos.ai_tags`. Default weights 70/30 semantic/keyword.
- **Sharing:** tokenized links (`nanoid(16)`) for kits and folders at `/k/[token]` and `/f/[token]`. Optional bcrypt password, optional expiry checked on every request; revoke by setting `expires_at` to now. Public links bypass auth for that one resource only.
- **Photographer upload portal** (`/upload/[token]`): admin issues an `upload_token` bound to a destination folder (expiry, optional max-files, photographer name/email, instructions). tus resumable upload → Vercel route → S3. Tagging runs in the background as uploads complete. The token bypasses auth for the upload action only.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15+ (App Router), TypeScript |
| Hosting | Vercel |
| DB / Auth / Vectors | Supabase (Postgres + Auth + pgvector) |
| Object storage | AWS S3 |
| Image variants | Next.js `<Image>` + Vercel image optimization |
| Raster transforms | `sharp` (SVG → PNG/JPG/WebP) |
| Vector transforms | `@resvg/resvg-js` + `pdf-lib` (SVG → PDF, vectors preserved) |
| Resumable uploads | tus (`tus-node-server`) |
| AI tagging | Anthropic Claude API (vision) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Background jobs | Inngest |
| Email | Resend (transactional only) |
| UI | shadcn/ui + Tailwind CSS |

## Conventions

- **TypeScript strict mode; no `any`.** Run `npm run typecheck` before considering work done.
- **App Router only** — no pages router.
- **Server components by default**; client components only where interactivity demands it.
- **Server actions for mutations.**
- shadcn/ui components live in `components/ui/` and may be customized there.
- **Tailwind only** — no CSS modules, no styled-components.
- Conventional commits.
- Tests: Vitest for units, Playwright for critical flows (upload, share access, tagging pipeline).
- Database migrations via Supabase CLI, checked into `supabase/migrations/`.
- Roles enforced via Supabase **RLS**: `admin` (full control), `editor` (upload/organize/share, no deletes of others' uploads, no user mgmt), `viewer` (read-only).

## Design Principles

The UI must read as **designer-grade, not developer-grade**. Reference points: Linear, Vercel dashboard, Frontify, Are.na. Influence is Swiss design — clarity over decoration, structure over chaos.

- **Typography:** Inter (or similar geometric sans) for UI; JetBrains Mono for hex values and code.
- **Color:** restrained neutral palette by default — let the assets be the color.
- **Density:** generous whitespace; never crowded.
- **Imagery:** photo grids are the hero — large, sharp, edge-to-edge where layout allows.
- **Motion:** subtle and purposeful (Framer Motion); never decorative.
- No emoji in UI chrome. No gradients, no glassmorphism, no trendy ornamentation.
- Information hierarchy is sacred — one primary action per screen.

## Secrets

Credentials live in `.env.local` (git-ignored) and Vercel env vars — never committed. `.env.example` documents the required keys with empty values. See `SPEC.md` → Environment Variables for the full list. The credentials currently in `SPEC.md` are initial development values to be rotated before production.

## Scope (v1)

Build the v1 "Core" scope from `SPEC.md` only. **Non-goals for v1:** multi-tenancy beyond Soteria, real-time collaboration/approval workflows, video transcoding, native mobile apps, face recognition, public brand microsite. SVG conversion and palette exports are **v2** — do not build them in v1 unless asked.

## Open Questions

Three decisions in `SPEC.md` ("Open Questions") are unresolved: Zenfolio migration, Lingo migration, and backup strategy. **Do not invent answers** — surface them when relevant.
