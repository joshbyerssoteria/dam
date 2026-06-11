/**
 * White-label org configuration. Each deployment serves exactly one
 * organization; these values are that organization's identity.
 *
 * Defaults are Soteria's so the upstream deployment runs with no extra env.
 * A forked deployment rebrands entirely through env vars (see
 * docs/SELF_HOSTING.md) — never hardcode an org name, logo path, or contact
 * wording in app code; add a field here instead.
 *
 * NEXT_PUBLIC_ vars are inlined at build time, so this module is safe to
 * import from both server and client components.
 */
export const org = {
  /** Short name used in prose ("the Soteria team has your photos"). */
  name: process.env.NEXT_PUBLIC_ORG_NAME ?? "Soteria",
  /** Full display name (logo alt text, metadata description). */
  fullName: process.env.NEXT_PUBLIC_ORG_FULL_NAME ?? "Soteria Church",
  /** Product name shown in titles and public-page chrome. */
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Soteria Assets",
  /** Who to contact when a link is dead ("Contact the …"). */
  contactTeam: process.env.NEXT_PUBLIC_ORG_CONTACT_TEAM ?? "Soteria comms team",
  /** Placeholder for the login email field. */
  loginEmailPlaceholder:
    process.env.NEXT_PUBLIC_LOGIN_EMAIL_PLACEHOLDER ?? "you@soteria.church",
  /** Path under public/ to the primary horizontal logo. */
  logoPath:
    process.env.NEXT_PUBLIC_ORG_LOGO_PATH ?? "/branding/logos/horizontal-navy.svg",
  /**
   * The Brand Guide section (/brand, lib/brand.ts, public/branding/) is org
   * content, not app code. Forks run with it off until they replace the
   * brand pack with their own.
   */
  brandGuideEnabled: process.env.NEXT_PUBLIC_BRAND_GUIDE !== "off",
} as const;

/**
 * Inngest app id — server-only. Must stay stable for the life of a
 * deployment (changing it orphans the registered Inngest app).
 */
export const inngestAppId = process.env.INNGEST_APP_ID ?? "soteria-dam";
