# Soteria Brand Guide Site

A single-page static deployment of the Soteria brand guide.

## Contents

- `index.html` — the full brand guide
- `photos/` — curated sample photography
- `vercel.json` — deployment config

## Deploying to Vercel

1. Install the Vercel CLI: `npm i -g vercel`
2. From this directory, run: `vercel`
3. Follow the prompts. For production: `vercel --prod`

Alternatively, drop this folder into a Vercel dashboard via "Add New Project"
→ "Import" → upload as a zipped folder (no build step required).

## Domains

If deploying to a custom subdomain (e.g. brand-guide.soteriachurch.com):
1. Add the domain in the Vercel project settings
2. Point a CNAME record at `cname.vercel-dns.com`

## Moving to soteria-church later

The `index.html` file is self-contained — fonts are loaded from Google Fonts,
all styles are inline, all images are SVG placeholders embedded as data URIs.
You can copy the file into any Next.js or WordPress project as a single asset.
