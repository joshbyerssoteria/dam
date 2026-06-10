/**
 * Soteria brand system content, distilled from branding/brand-guidelines.md
 * (the source of truth — keep in sync when the guidelines change).
 * Assets live in public/branding/.
 */

export const BRAND = {
  navy: "#1B2A41",
  gold: "#C2912D",
  offwhite: "#F2EEE7",
  white: "#FFFFFF",
  muted: "#5F5E5A",
  hairline: "#E5DFD1",
  error: "#B43C3C",
} as const;

export const BRAND_COLORS = [
  {
    id: "navy",
    hex: BRAND.navy,
    name: "Navy",
    role: "Structural voice / dark ground",
    rgb: "27, 42, 65",
    share: 30,
  },
  {
    id: "gold",
    hex: BRAND.gold,
    name: "Gold",
    role: "Accent only",
    rgb: "194, 145, 45",
    share: 5,
  },
  {
    id: "offwhite",
    hex: BRAND.offwhite,
    name: "Off-white",
    role: "Warm ground, backgrounds only",
    rgb: "242, 238, 231",
    share: 10,
  },
  {
    id: "white",
    hex: BRAND.white,
    name: "White",
    role: "Default canvas",
    rgb: "255, 255, 255",
    share: 55,
  },
] as const;

export const SUPPORTING_COLORS = [
  { id: "muted", hex: BRAND.muted, name: "Muted", role: "Secondary text, captions, metadata" },
  { id: "hairline", hex: BRAND.hairline, name: "Hairline", role: "Borders, dividers, row separators" },
  { id: "error", hex: BRAND.error, name: "Error", role: "Error states only" },
] as const;

export const COLOR_RULES = [
  "Navy outweighs off-white. Off-white is the lighter accent, used sparingly for warmth — never as the default ground where white would serve.",
  "Off-white is a background only. Never use it as text or icon fills. Text on navy is white, never off-white.",
  "Gold stays rare — a rule, a label, a small chip. The eye is drawn to gold, so use it to direct attention sparingly.",
  "Never navy on gold. Reads muddy even though contrast technically passes. Use navy with white text or gold with white text.",
  "No other colors. No red, green, or blue accents. The only non-system color permitted is #B43C3C for error feedback.",
  "No grays. Muted text uses the warm muted neutral. Skeletons use a navy tint — never #ccc.",
  "Gradients are sparing. Navy washes on photography are standard; other gradients are case-by-case.",
] as const;

// ---------------------------------------------------------------------------
// Logos
// ---------------------------------------------------------------------------

export type LogoColor = "navy" | "white" | "black" | "gold";

export interface LogoLockup {
  type: "horizontal" | "stacked" | "wordmark" | "logomark";
  title: string;
  useFor: string;
}

export const LOGO_LOCKUPS: LogoLockup[] = [
  {
    type: "horizontal",
    title: "Horizontal",
    useFor: "Default. Headers, footers, anywhere with horizontal room.",
  },
  {
    type: "stacked",
    title: "Stacked",
    useFor: "Square-ish frames. App icons, social profile images, badges.",
  },
  {
    type: "wordmark",
    title: "Wordmark",
    useFor: "The Soteria text alone, no mark. Sub-brand contexts, small chrome.",
  },
  {
    type: "logomark",
    title: "Logomark",
    useFor: "The six-circle mark alone. Favicons, watermarks, sub-spaces under ~24px.",
  },
];

export const LOGO_COLORS: Array<{
  color: LogoColor;
  label: string;
  /** ground the preview tile should use so the mark is visible */
  ground: string;
}> = [
  { color: "navy", label: "Navy", ground: BRAND.white },
  { color: "white", label: "White", ground: "#E4E4E4" },
  { color: "black", label: "Black", ground: BRAND.white },
  { color: "gold", label: "Gold", ground: BRAND.white },
];

export function logoPath(
  type: LogoLockup["type"],
  color: LogoColor,
  format: "svg" | "png"
): string {
  return `/branding/logos/${type}-${color}.${format}`;
}

export const LOGO_DONTS = [
  "Stretch — preserve aspect ratio always.",
  "Recolor — only the four official colors. No hue shifts, no tints.",
  "Rotate — always horizontal/vertical, never angled.",
  "Drop shadow — no shadows, glows, or 3D effects.",
  "Place on a busy photo — use a navy wash or pull to white space.",
  "Navy on gold — use white-on-gold or navy-on-white instead.",
] as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const TYPE_ROLES = [
  {
    role: "Display",
    weight: "700",
    size: "32–96px",
    tracking: "-0.02em to -0.035em",
    case: "Sentence",
    use: "Headlines, hero copy, poster titles",
  },
  {
    role: "Body",
    weight: "400",
    size: "14–18px",
    tracking: "0",
    case: "Sentence",
    use: "All running copy",
  },
  {
    role: "Label",
    weight: "700",
    size: "8–12px",
    tracking: "0.14em to 0.28em",
    case: "Uppercase",
    use: "Eyebrow headings only",
  },
] as const;

export const FONT_LOADING_SNIPPET = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet">`;

export const CSS_VARIABLES_SNIPPET = `:root {
  /* Brand */
  --navy: #1B2A41;
  --gold: #C2912D;
  --offwhite: #F2EEE7;
  --white: #FFFFFF;

  /* Supporting */
  --muted: #5F5E5A;
  --hairline: #E5DFD1;
  --error: #B43C3C;

  /* Type */
  --font-sans: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  --font-serif: 'Lora', Georgia, 'Times New Roman', serif;

  /* Radius */
  --radius-pill: 9999px;
  --radius-card: 0;
}`;

export const TYPE_RULES = [
  "Default jump is 400 (body) straight to 700 (display). Mid-weights are fine for subtle UI hierarchy.",
  "Use weight, a gold rule, or italics for emphasis. Don't stack them.",
  "No all-caps body copy. All-caps is for labels and small accents only.",
  "Tracking is for eyebrow headings only — everywhere else uppercase sits at 0 tracking.",
  "Line-height: 1.02–1.1 for display, 1.55–1.7 for body, 1.15–1.25 for titles.",
] as const;

// ---------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------

export const VOICE = {
  summary:
    "Direct, plain, biblical. Short titles that say what something is and get out of the way.",
  weAre: [
    "A Baptist church",
    "A refuge of truth",
    "A family in mission",
    "Honest about hard things",
    "Confident the Bible is true",
  ],
  weAreNot: [
    "Hip, edgy, ironic",
    "Trying to “speak to culture” with clever metaphors",
    "Using cute prepositional headlines (“On knowing.”)",
    "Calling buildings or programs “experiences”",
    "Reaching for “journey,” “unleash,” “authentic,” “intentional”",
  ],
  headlinesThatWork: [
    "Making more & better disciples.",
    "There's a seat saved for you.",
    "We'd love to meet you this Sunday.",
    "Every word of the Bible is true.",
    "A refuge of truth. A family in mission.",
    "Come as you are.",
  ],
  headlinesThatDont: [
    { text: "The system, end to end.", why: "too clever / abstract" },
    { text: "Where the brand lives.", why: "AI-ish" },
    { text: "When the image carries.", why: "metaphor-as-headline" },
    { text: "The hope you've been searching for…", why: "over-promising" },
    { text: "Authentic community for the modern believer", why: "marketing-speak" },
  ],
} as const;

// ---------------------------------------------------------------------------
// Photography
// ---------------------------------------------------------------------------

export const PHOTO_TREATMENTS = [
  {
    id: "untreated",
    name: "Untreated",
    when: "Portraits, product shots, detail moments. Full photo, no overlay.",
  },
  {
    id: "gradient",
    name: "Bottom gradient",
    when: "Type sits in the lower third — heroes, sermon series, event posters.",
  },
  {
    id: "wash",
    name: "Full navy wash",
    when: "Centered type over photo — quote cards, CTA blocks, invitations.",
  },
  {
    id: "card",
    name: "Photo + card",
    when: "Photo sits inside a colored ground card. Cards, modules, listings.",
  },
] as const;

export const PHOTO_RULES = [
  "No color overlays except navy (for white-text legibility). No gold tints, no duotones, no filters.",
  "Gold stays in the supporting type only — never on the image.",
  "Type only sits on a photo when a navy wash or gradient gives white text enough contrast.",
  "White text on photography. Navy text on light grounds beside photography. Off-white text never sits on photography.",
  "If the image is strong, the composition around it should be quiet — and vice versa.",
] as const;

// ---------------------------------------------------------------------------
// Layout, accessibility, mistakes
// ---------------------------------------------------------------------------

export const LAYOUT_PRINCIPLES = [
  { title: "8px grid", body: "Spacing values are multiples of 8: 8, 16, 24, 32, 48, 64. Arbitrary spacing reads sloppy even when the eye doesn't consciously catch it." },
  { title: "Whitespace", body: "Every composition should have significantly more empty space than feels comfortable. Whitespace tells the eye what matters." },
  { title: "One featured moment", body: "One dominant hero per page — one headline, one featured event, one primary CTA. Within any single moment, keep it to one." },
  { title: "Left-aligned by default", body: "Centered only when the composition is symmetric by design. Ragged right over justification." },
  { title: "Color divides sections", body: "Sections separate by background changes (white → off-white → navy). Rules and framed cards must earn their place." },
] as const;

export const CONTRAST_TABLE = [
  { pair: "Navy on white", ratio: "12.6:1", verdict: "Passes" },
  { pair: "White on navy", ratio: "12.6:1", verdict: "Passes" },
  { pair: "Navy on off-white", ratio: "11.5:1", verdict: "Passes" },
  { pair: "Muted on white", ratio: "5.3:1", verdict: "Passes for body 400+; not for ≤12px below weight 700" },
  { pair: "Gold on white", ratio: "3.6:1", verdict: "Large text only (≥18pt, or ≥14pt bold). Never body copy" },
  { pair: "Gold on navy", ratio: "4.4:1", verdict: "Large text only. Fine for eyebrows and rules" },
] as const;

export const COMMON_MISTAKES = [
  "Off-white as text. Off-white is a background-only color.",
  "Navy on gold. Use white on gold instead.",
  "Gold body text. Gold is for accents — rules, eyebrows, small marks.",
  "Mixed corner radii. Buttons are full pills; cards are square or one large fixed radius.",
  "Drop shadows. Hairlines and color-ground separation handle elevation.",
  "All-caps body copy. All-caps is for labels only.",
  "Tracking on uppercase outside eyebrows.",
  "Centered everything. Default is left-aligned.",
  "Multiple primary CTAs in one moment. One primary per moment.",
  "The logo on a busy photo, stretched, or recolored.",
] as const;

export const IDENTITY = {
  name: "Soteria Church",
  type: "A Baptist church",
  location: "West Des Moines, Iowa",
  tagline: "Making more & better disciples.",
  serviceTimes: "Sundays at 8:30 and 10:30 AM",
  pillars: ["the Word", "the People", "the Presence", "the Mission"],
} as const;

export const BRAND_SUMMARY =
  "Four colors. Inter + Lora. One primary per moment. White dominates. Navy carries structural weight. Off-white accents with warmth. Gold punctuates — sparingly, always deliberate. Photography carries what the system can't, and the system gets out of the way when it does.";
