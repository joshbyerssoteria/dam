# Soteria DAM — Project Spec

## Context

Soteria is a multi-site church in West Des Moines, Iowa. This project replaces two SaaS tools with a custom Digital Asset Management application tailored to Soteria's workflows.

**Tools being replaced:**
- **Lingo** — currently manages brand assets (logos, color palettes, fonts, templates) organized into "Kits"
- **Zenfolio** — currently manages photo galleries and event archive in folder/subfolder/gallery hierarchy

**Team shape:**
- 20–30 internal users; 2–5 power users daily, the rest occasional
- External marketing agency with frequent access
- Volunteer photographers who upload event coverage
- Comms director collaborates daily on assets

## Project Resources

> **Note:** Credentials are initial development values and will be rotated before production. They live in `.env.local` (git-ignored) and Vercel environment variables — never in source control, including this file.

| Resource | Value |
|---|---|
| GitHub repo | `https://github.com/joshbyerssoteria/dam.git` |
| Production URL | `https://assets.soteria.church` |
| Hosting | Vercel (connected to the repo above) |
| Supabase project URL | `https://mdtectgfqdowzoepqvrk.supabase.co` |
| Supabase publishable key | see `.env.local` (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| Postgres connection | see `.env.local` (`DATABASE_URL` — use the IPv4 session pooler) |

## Goals

1. Single application that handles both brand assets and photo libraries
2. AI-tagged photo search — both keyword and semantic ("photos of hands raised in worship")
3. Tokenized share links for kits, folders, and albums (with optional password and expiry)
4. Photographer upload portal accessed via tokenized link
5. SVG → on-demand format and size conversion (PNG, JPG, WebP, PDF)
6. Color palettes as first-class objects with multi-format export (ASE, ACO, CSS, JSON, Tailwind)
7. Designer-grade UI — must look and feel as polished as the SaaS it replaces

## Non-Goals (v1)

- Multi-tenancy beyond Soteria (Visual Theology, Infinite Design Co. are future spaces). Note: the app is **packaged for other churches as single-tenant deployments** (one church = one instance) — see `docs/PACKAGING.md`; that is distinct from in-app multi-tenancy, which remains a non-goal.
- Real-time collaboration or approval workflows
- Video transcoding
- Native mobile apps (responsive web only)
- Face recognition (deferred — privacy implications need explicit decision)
- Public-facing brand microsite

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 15+ (App Router), TypeScript | Matches existing Table app stack |
| Hosting | Vercel | Existing infrastructure |
| Database | Supabase (Postgres + Auth + pgvector) | Single managed service for db, auth, and vector search |
| Object storage | AWS S3 | Soteria's existing infrastructure; reuse IAM and bucket conventions |
| Image variants | Next.js `<Image>` + Vercel image optimization | Automatic resizing and WebP/AVIF conversion at the edge |
| Raster transforms | `sharp` | SVG → PNG/JPG/WebP at any size |
| Vector transforms | `@resvg/resvg-js` + `pdf-lib` | SVG → PDF with vectors preserved |
| Resumable uploads | tus protocol (`tus-node-server`) | Reliable for large photographer uploads |
| AI tagging | Anthropic Claude API (vision) | Context-aware over generic CV services |
| Embeddings | OpenAI `text-embedding-3-small` | Cheap, fast, 1536 dimensions |
| Background jobs | Inngest | Reliable tagging pipeline with retries |
| Email | Resend | Transactional only (uploads, share notifications) |
| UI components | shadcn/ui + Tailwind CSS | Designer control, no opinionated styling baked in |

## Data Model

Two parallel trees — kits (brand assets) and folders (photos). Different mental models; do not conflate them in the schema.

```sql
-- Workspace (one for v1: Soteria)
spaces (id, name, slug, created_at)

-- Brand asset side (replaces Lingo)
kits (
  id, space_id, slug, name, description,
  share_token, share_password_hash, share_expires_at,
  cover_image_id, sort_order, created_at, updated_at
)

kit_assets (id, kit_id, asset_type, asset_id, sort_order, created_at)
  -- asset_type: 'file' | 'palette' | 'font'
  -- asset_id: polymorphic reference

files (id, s3_key, s3_bucket, mime_type, original_filename, file_size, width, height, uploaded_by, created_at)

palettes (id, kit_id, name, description, sort_order, created_at)
colors  (id, palette_id, hex, name, role, rgb, cmyk, pantone, sort_order)

fonts      (id, kit_id, family, foundry, license_note, sort_order, created_at)
font_files (id, font_id, weight, style, file_id)

-- Photo side (replaces Zenfolio)
folders (
  id, space_id, parent_id, slug, name, description,
  share_token, share_password_hash, share_expires_at,
  cover_photo_id, sort_order, created_at
)

photos (
  id, folder_id, file_id,
  ai_tags text[], ai_caption text, ai_scene text, event_type text,
  embedding vector(1536),
  taken_at, photographer_name, uploaded_by, created_at
)

-- Projects: nestable, team-shared collections that REFERENCE photos for a
-- piece of work. Photos are linked, never moved or copied; deleting a
-- project (or unlinking a photo) only removes link rows.
projects       (id, space_id, parent_id, name, description, sort_order, created_by, created_at)
project_photos (project_id, photo_id, added_by, added_at)

-- Sharing and uploads
share_links (
  id, token UNIQUE, target_type, target_id,
  expires_at, password_hash, download_count, created_by, created_at
)
  -- target_type: 'kit' | 'folder'

upload_tokens (
  id, token UNIQUE, target_folder_id,
  expires_at, max_files, used_count,
  photographer_name, photographer_email, instructions,
  created_by, created_at
)

-- Audit
download_log (id, share_token, file_id, ip_hash, downloaded_at)
upload_log   (id, upload_token, file_id, uploaded_at)

-- Users via Supabase Auth; extended with role: 'admin' | 'editor' | 'viewer'
```

## Phased Build

### v1 — Core

Estimated 60–80 disciplined hours.

**Auth and space**
- Supabase Auth, magic link login
- Single space (Soteria) seeded on first run
- Three roles: admin, editor, viewer

**Photo library**
- Folder tree with arbitrary nesting
- Drag-and-drop upload (single or multi)
- Background job: Claude vision generates tags + caption + scene + event_type; embedding stored in pgvector
- Gallery view with responsive grid, fast variants via Next.js Image optimization
- Lightbox preview with metadata sidebar
- Hybrid search: keyword (ai_tags) + semantic (vector similarity), single endpoint
- Download single photo at original quality

**Kits and brand assets**
- Create kit with name, slug, description, cover image
- Add file assets to kit (any file type)
- Add palettes (name + colors with hex, name, role)
- Suggest a probable palette from the kit's source file (rasterize the master .ai/PDF first artboard, quantize dominant colors with `sharp`, then name/role them with Claude vision; editor reviews and edits before saving). Falls back to raw sampled hex when `ANTHROPIC_API_KEY` is unset. See `lib/palette-extract.ts`.
- Add fonts (family + uploaded files)
- Palette swatches render as live UI with click-to-copy hex
- Kit detail page shows all asset types together in one nav

**Sharing**
- Generate tokenized share link for any kit or folder
- Public view at `/k/[token]` and `/f/[token]`
- Optional password
- Optional expiry
- Download-all (zip) for shared folder or kit

**Photographer upload portal**
- Admin generates upload_token tied to a destination folder
- Portal at `/upload/[token]` — drag-drop, tus resumable
- AI tagging runs in background as uploads complete
- Confirmation page on completion

### v2 — Polish

Build only after v1 is in active use.

- SVG → on-demand format conversion (`sharp` + `@resvg/resvg-js` + `pdf-lib`), edge-cached
- Color palette exports: ASE (Illustrator), ACO (Photoshop), CSS variables, JSON, Tailwind config
- Font specimen auto-rendering (preview image generated server-side)
- Bulk operations: multi-select photos for move/tag/delete
- Cover image picker UI for folders and kits
- Photographer email notification on successful upload
- Comms director email digest of new uploads

### v3 — Future

- Face recognition (explicit decision required — privacy)
- Approval workflows
- Asset versioning
- Multi-space support (Visual Theology, Infinite Design Co.)
- Public brand microsite generation from a kit
- Read API for programmatic retrieval

## Implementation Notes

### AI Tagging Pipeline

On photo upload completion:
1. Inngest triggers tagging job
2. Job fetches a small image variant via Next.js image route or generates one on demand with `sharp`
3. Sends to Claude vision with this structured prompt:

```
You are analyzing a photograph from a church event archive for a Digital Asset Management system. Return ONLY valid JSON with these fields:

{
  "tags": ["array of 5-15 specific descriptive tags covering people, actions, settings, objects, mood"],
  "scene": "one-sentence factual description of what is happening",
  "caption": "one descriptive sentence optimized for semantic search — include people, action, setting, emotional tone",
  "event_type": "one of: worship_service, baptism, kids_ministry, students, men, women, conference, fellowship, outdoor, other"
}
```

The `event_type` list above is the default taxonomy; white-label deployments
override it with `NEXT_PUBLIC_EVENT_TYPES` (comma-separated, `other` always
included), and `lib/tagging.ts` interpolates the active list into the prompt.

4. Embed the `caption` with `text-embedding-3-small` → 1536-dim vector
5. Store all fields on the photo row

### Search

Single endpoint `/api/search?q=...`:
1. Generate embedding for query
2. Run hybrid query in Postgres:
   - Vector similarity (cosine distance) on `photos.embedding`
   - Keyword overlap on `photos.ai_tags`
   - Combined score with configurable weights (start 70/30 semantic/keyword)
3. Apply a relative relevance cutoff — keep only results scoring within a
   fraction (`RELEVANCE_RATIO`, default 0.85) of the top hit, dropping the weak
   tail the recall query pads in. Adapts per query (dense subjects keep
   everything; sparse subjects trim aggressively) and never returns empty.
4. Return ranked results with snippets

### SVG Transforms (v2)

URL pattern: `/api/transform/[file_id]?format=png&width=1200`

- Server checks edge cache; returns cached if hit
- Raster output: `sharp` reads SVG buffer, outputs requested format/size
- PDF output: `@resvg/resvg-js` rasterizes for preview; `pdf-lib` embeds original SVG paths in PDF for vector preservation
- Edge-cache with long TTL keyed on (file_id, format, width, height)
- Stream response

Supported outputs: PNG, JPG, WebP, PDF, original SVG

### Share Tokens

- Generate with `nanoid(16)`
- Optional bcrypt password
- Check expiry on every request
- Increment `download_count` on each download
- Revocation: set `expires_at` to now

### Photographer Upload Portal

Admin token generation:
- Destination folder
- Expiry datetime
- Max files (optional cap)
- Photographer name and email
- Optional instructions text shown on portal

Public portal at `/upload/[token]`:
- Soteria branding, instructions, generous drop zone
- tus resumable upload to Vercel route → S3
- Progress bar per file
- Confirmation page with summary
- Background tagging triggers as uploads complete

## Design Principles

The UI must read as designer-grade, not developer-grade. Reference points: Linear, Vercel dashboard, Frontify, Are.na.

- **Typography:** Inter or similar geometric sans for UI; JetBrains Mono for hex values and code
- **Color:** Restrained neutral palette by default — let the assets be the color
- **Density:** Generous whitespace; never crowded
- **Imagery:** Photo grids are the hero — large, sharp, edge-to-edge where the layout allows
- **Motion:** Subtle and purposeful (Framer Motion); never decorative
- **No emoji in UI chrome**
- **No gradients, no glassmorphism, no trendy ornamentation**
- **Information hierarchy is sacred** — one primary action per screen

Influence is Swiss design: clarity over decoration, structure over chaos. Every element earns its presence by clarifying meaning.

## Auth and Roles

- Magic link login via Supabase Auth
- Three roles, enforced via Supabase RLS:
  - **admin** — full control; manage users, generate tokens, delete anything
  - **editor** — upload, organize, generate share links; cannot delete others' uploads or manage users
  - **viewer** — read-only access to all assets
- Public share links bypass auth for the specific resource only
- Upload tokens bypass auth for the upload action only — no other access granted

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://mdtectgfqdowzoepqvrk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=        # see .env.local
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=                         # see .env.local — IPv4 session pooler URL

AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
S3_PUBLIC_BASE_URL=

ANTHROPIC_API_KEY=
OPENAI_API_KEY=

RESEND_API_KEY=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
INNGEST_APP_ID=                       # default soteria-dam; stable per deployment

# White-label identity (all optional — defaults are Soteria's; lib/config.ts)
NEXT_PUBLIC_ORG_NAME=
NEXT_PUBLIC_ORG_FULL_NAME=
NEXT_PUBLIC_APP_NAME=
NEXT_PUBLIC_ORG_CONTACT_TEAM=
NEXT_PUBLIC_LOGIN_EMAIL_PLACEHOLDER=
NEXT_PUBLIC_ORG_LOGO_PATH=
NEXT_PUBLIC_ORG_TIMEZONE=             # IANA tz for the home greeting; default America/Chicago
NEXT_PUBLIC_BRAND_GUIDE=              # "off" hides the built-in Brand Guide
NEXT_PUBLIC_EVENT_TYPES=              # comma-separated tagging taxonomy override
```

## Repository Conventions

- TypeScript strict mode, no `any`
- Conventional commits
- App Router only — no pages router
- Server actions for mutations
- Server components by default; client components only where interactivity demands
- shadcn/ui customized in `components/ui/`
- Tailwind only — no CSS modules, no styled-components
- Tests: Vitest for units, Playwright for critical flows (upload, share access, tagging pipeline)
- Database migrations via Supabase CLI, checked into repo

## Open Questions

These need decisions before or during v1 — do not invent answers.

1. **Migration from Zenfolio.** ✅ **Resolved 2026-06-11.** The account is on **new Zenfolio** (zenfoliosite.com), where the Classic SOAP API doesn't exist — so the documented path was a dead end. Instead, `scripts/import-zenfolio-api.mjs` drives the NextZen dashboard's internal REST API (reverse-engineered via the logged-in browser session): folder tree → per-album photos → `PUT /api/folders/v1/photos/download` for each original. Mirrors the hierarchy under a "Photo Archive" root, preserves capture dates, verified byte-exact. 129 albums / 16,513 photos (~175–335 GB). Concurrent (10 workers), bandwidth-bound (~14–24h), resumable by photoId-keyed S3 path. Auth via a month-valid session JWT in `.env.local` (ZENFOLIO_TOKEN). Run with `node scripts/import-zenfolio-api.mjs import`; AI-tag afterward with `scripts/backfill-tags.mjs`.
2. **Migration from Lingo.** ✅ **Resolved 2026-06-10.** `scripts/import-lingo.mjs` (built on the official `@lingo-app/node` SDK) imported all 13 kits — 774 assets, 45 sections, 17 palettes/70 colors — with zero failures. Lingo sections map to kit sections; color assets (stored as HSB in Lingo) convert to hex palettes per section. Fonts did not exist as file assets in the space. The script is idempotent (skips kits whose slug exists) and kept for reference.
3. **Backup strategy.** S3 with versioning enabled covers most accidents. For deep-archive protection, configure an S3 Lifecycle rule to replicate to S3 Glacier Deep Archive or to a second bucket in another region. Decide before storing irreplaceable photos.

## Decision Log

Decisions made during the build that adjust the plan above:

1. **2026-06-10 — Beta uploads are direct POST, not tus.** `@tus/server` v1.x exposes only a Node `http` handler (no fetch-API handler), which doesn't integrate cleanly with App Router routes, and its file store doesn't survive stateless serverless invocations. The beta uses a direct upload route (`/api/upload/direct`) with per-file XHR progress for both the app and the photographer portal. Resumable uploads (tus or S3 multipart presigned) are the first production-hardening task before large-batch photographer uploads.
2. **2026-06-10 — Image variants via authenticated route, not Next `<Image>`.** Vercel's image optimizer fetches upstream without auth cookies, so it cannot serve access-controlled originals. Variants are generated by `sharp` in `/api/files/[id]?w=` (and the share-scoped equivalent) with cache headers. Revisit if originals move to public-read S3 behind a CDN.
3. **2026-06-10 — Local-disk storage fallback.** When AWS credentials are absent, uploads are stored under `.uploads/` and rows record bucket `_local`. This makes the beta fully testable with zero AWS setup; S3 activates automatically once `AWS_*` and `S3_BUCKET_NAME` are set.
4. **2026-06-10 — Database access uses the session pooler.** The direct `db.<ref>.supabase.co` host is IPv6-only; use `aws-1-us-west-2.pooler.supabase.com:5432` with user `postgres.<project-ref>` for migrations and tooling from IPv4 networks.
5. **2026-06-10 — First sign-up becomes admin.** Bootstrap rule implemented as a database trigger; subsequent sign-ups default to viewer.
6. **2026-06-10 — Presigned S3 uploads (supersedes the interim note in #1).** Browser uploads go straight to S3 via presigned PUT (`/api/upload/presign` → `/api/upload/complete`), fixing failures for files over Vercel's 4.5 MB body limit. The direct route remains for local dev. Requires a CORS rule on the bucket allowing PUT from the app origins.
7. **2026-06-10 — SVG/raster transforms pulled forward from v2.** `/api/transform/[file_id]?format=png|jpg|webp&width=N` via `sharp`, session- or share-token-authorized. PDF output (resvg + pdf-lib) remains v2.
8. **2026-06-10 — Brand Guide integrated into the app.** The standalone brand site (branding.soteria.church) is superseded by an in-app Brand Guide section (`/brand` + Logos, Colors, Typography, Guidelines, Examples). Content is structured in `lib/brand.ts`, distilled from `branding/brand-guidelines.md` (still the written source of truth). Logo lockups and the curated photo set moved to `public/branding/` and serve statically.
9. **2026-06-10 — Schema extensions for kit organization.** `kit_folders` (nestable tree of kits, parallel to photo folders), `kit_sections` (named asset groups within a kit, drag-and-drop ordered via `kit_assets.section_id`/`sort_order`), and `fonts.source`/`external_ref` for Google Fonts and Adobe Fonts entries alongside uploaded font files.
10. **2026-06-10 — Packaged for other churches as a single-tenant deployment kit.** Strategy in `docs/PACKAGING.md`, runbook in `docs/SELF_HOSTING.md`. Org identity (app name, church name, contact wording, logo, login placeholder) is env-driven through `lib/config.ts` with Soteria defaults, so Soteria's deployment needs no env changes. The Brand Guide is treated as Soteria's replaceable "brand pack" and can be disabled with `NEXT_PUBLIC_BRAND_GUIDE=off`; the tagging event-type taxonomy is overridable via `NEXT_PUBLIC_EVENT_TYPES`; `npm run setup` provisions `.env.local` and renames the seeded space. In-app multi-tenancy remains a non-goal; the space-scoped schema is preserved so a hosted multi-tenant offering stays possible later.
11. **2026-06-11 — Projects: reference-based photo collections.** A second lightweight hierarchy under the Photos nav (alongside Favorites, which Projects may eventually replace): `projects` (nested via `parent_id`) + `project_photos` join. Photos are linked, never moved or copied — deleting a project, a subproject, or unlinking a photo never touches the photo row or its file. Editors and admins create, rename, re-nest (drag-and-drop in sidebar and card grid), and delete projects (deletion is safe by design, so it is not admin-only like folder deletion); viewers read. Photos join a project via the batch bar's "Add to project" (with inline project creation) from any folder, the Favorites page, or another project; the project page offers batch "Remove" (unlink). Routes: `/photos/projects` and `/photos/projects/[projectId]`.

---

This spec is the starting point. Implementation constraints may surface during the build that change individual decisions — update this document as those decisions are made. The spec is the source of truth.
