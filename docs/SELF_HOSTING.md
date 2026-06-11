# Self-Hosting Guide — Deploy This DAM for Your Church

This app is packaged as a **single-tenant deployment kit**: your church runs
its own instance with its own database, storage, and API keys. Nothing is
shared with any other deployment. Strategy background: `docs/PACKAGING.md`.

Expect the initial setup to take 30–60 minutes, most of it creating accounts.

## What you need

| Service | Used for | Tier that fits a single church |
|---|---|---|
| [GitHub](https://github.com) | your copy of this repo | free |
| [Vercel](https://vercel.com) | hosting the app | Hobby (free) or Pro |
| [Supabase](https://supabase.com) | database, auth, vector search | free tier to start |
| [AWS S3](https://aws.amazon.com/s3/) | original photo/asset storage | pay-as-you-go (storage is the main real cost) |
| [Anthropic](https://console.anthropic.com) | AI photo tagging | pay-as-you-go, pennies per hundred photos |
| [OpenAI](https://platform.openai.com) | search embeddings | pay-as-you-go, negligible |
| [Inngest](https://inngest.com) | background tagging jobs | free tier |

## 1. Get the code

Create your own repository from this one (GitHub "Use this template", or
fork), then:

```bash
git clone <your-repo>
cd <your-repo>
npm install
```

## 2. Create the services

1. **Supabase:** create a project. Note the Project URL, anon key, and
   service-role key (Settings → API), and the **session pooler** connection
   string (Settings → Database). Enable the `vector` extension if the
   migration doesn't (it does by default).
2. **S3:** create a private bucket (e.g. `yourchurch-dam-files`) and an IAM
   user with read/write limited to that bucket. Add a CORS rule allowing
   `PUT`/`POST` from your app domain (needed for resumable uploads).
3. **Anthropic / OpenAI:** create API keys.
4. **Inngest:** create an app; note the event key and signing key.

## 3. Run the setup wizard

```bash
npm run setup            # interactive; add --verify to test connections
```

The wizard asks for your church's identity (name, app title, logo path,
contact wording, optional custom event-type taxonomy) and the credentials
from step 2, writes `.env.local`, and renames the database "space" to your
organization.

**Logo:** drop your logo (SVG preferred) somewhere under `public/` and give
the wizard its path. The default Brand Guide section is Soteria's brand
content — leave it `off` unless you build your own brand pack (`lib/brand.ts`
and `public/branding/`).

## 4. Apply database migrations

```bash
npx supabase link        # link to your Supabase project
npx supabase db push     # creates schema, RLS policies, seed space
```

If you ran setup before the first `db push`, run `npm run setup` again (it
keeps your answers) so the space rename lands.

## 5. First run

```bash
npm run dev              # http://localhost:3000
```

Sign in with a magic link. **The first account to sign in is automatically
promoted to admin** (database trigger); everyone after that starts as a
viewer until an admin changes their role in Settings.

## 6. Deploy to production

1. Import your repo into Vercel.
2. Copy every variable from `.env.local` into the Vercel project's
   environment variables, changing `NEXT_PUBLIC_APP_URL` to your production
   domain.
3. In Supabase → Authentication → URL Configuration, add your production
   domain to redirect URLs.
4. Connect the Inngest Vercel integration (or set the keys manually) so the
   tagging pipeline runs in production.
5. Add your production domain to the S3 CORS rule.

## Updating

Pull from the upstream template repo and redeploy:

```bash
git remote add upstream <template-repo>   # once
git pull upstream main
npx supabase db push                      # apply any new migrations
```

Customizations live in env vars and your brand pack, not in app code, so
updates should merge cleanly.

## What's intentionally per-church

- **All data** — your Supabase project and S3 bucket are yours alone.
- **All spend** — AI tagging bills to your own Anthropic/OpenAI keys.
- **Roles** — `admin` / `editor` / `viewer`, enforced by row-level security.
- **Event types** — `NEXT_PUBLIC_EVENT_TYPES` tailors the AI tagging
  taxonomy to your ministries (always includes `other` as a fallback).
