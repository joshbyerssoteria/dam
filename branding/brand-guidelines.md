# Soteria Church — Brand Guidelines

A portable pack for any new Soteria-branded project. Copy this whole `branding/` directory into the new repo and treat this file as the source of truth.

---

## What's in this pack

```
branding/
├── brand-guidelines.md     # this file
├── logos/                  # all official SVG + PNG lockups (17 variants + favicons)
│   ├── horizontal-{black,gold,navy,white}.{svg,png}
│   ├── stacked-{black,gold,navy,white}.{svg,png}
│   ├── wordmark-{black,gold,navy,white}.{svg,png}
│   ├── logomark-{black,gold,navy,white}.{svg,png}
│   ├── favicon-{dark,light}.{svg,png}
│   ├── logo-whitespace.{svg,png}     # official clear-space diagram
│   └── logo-symbology.png            # the meaning of the mark
└── photos/                 # curated photography (see Photography section)
```

Live brand guide: <https://branding.soteria.church>
Source repo: <https://github.com/joshbyerssoteria/soteria-church>

---

## 1. Identity

- **Name**: Soteria Church
- **Type**: A Baptist church
- **Location**: West Des Moines, Iowa
- **Mission tagline**: "Making more & better disciples."
- **Service times**: Sundays at 8:30 and 10:30 AM
- **Lead pastor**: Dr. Mike Augsburger
- **Pastoral staff**: Cody Crigger (Executive), Zach Dietrich (Theology & Education), Monty Kaufman (Church Life), Aaron Pals (Care), Scott Ward (Care)
- **Core ministries**: Growth Groups, Soteria Kids, Student Ministry, Women's (Flourish), Care, Family
- **Four pillars**: the Word, the People, the Presence, the Mission

---

## 2. Color

Four colors. No more. The entire system is built on these and only these.

| Token | Hex | RGB | Role |
|---|---|---|---|
| `--navy` | `#1B2A41` | 27, 42, 65 | Structural voice / dark ground |
| `--gold` | `#C2912D` | 194, 145, 45 | Accent only |
| `--offwhite` | `#F2EEE7` | 242, 238, 231 | Warm ground, backgrounds only |
| `--white` | `#FFFFFF` | 255, 255, 255 | Default canvas |

### Supporting (functional, not brand)

| Token | Hex | Role |
|---|---|---|
| `--muted` | `#5F5E5A` | Secondary text, captions, metadata |
| `--hairline` | `#E5DFD1` | Borders, dividers, table row separators |
| `--error` | `#B43C3C` | Error states only |

### The Ratio

- **White ~55%** — default canvas, the dominant ground
- **Navy ~30%** — structural accent ground
- **Off-white ~10%** — warmth, editorial moments
- **Gold ~5%** — accent ink

### Rules

1. **Navy outweighs off-white.** Off-white is the lighter accent, used sparingly for warmth — never as the default ground where white would serve.
2. **Off-white is a background only.** Never use it as text or icon fills. Text on navy is **white** (`#FFFFFF`), never off-white.
3. **Gold stays rare** — a rule, a label, a small chip. The eye is drawn to gold, so use it to direct attention sparingly.
4. **Never navy on gold.** Reads muddy even though contrast technically passes. For navy + gold moments, use navy with white text or gold with white text.
5. **No other colors.** No red, green, or blue accents. The only non-system color permitted is `#B43C3C` for error feedback.
6. **No grays.** Muted text uses `--muted` (a warm neutral). Skeletons/loading use `rgba(27, 42, 65, 0.08)` — a navy tint — never `#ccc`.
7. **Gradients are sparing.** Navy washes/gradients on photography are standard. Other gradients are case-by-case.

---

## 3. Typography

**Two typefaces**: Inter and Lora. Both free on Google Fonts.

- **Inter** — primary. UI, labels, body, all display.
- **Lora** — serif companion. The wordmark and select editorial body: scripture, long-form articles, quotes, asides.

When in doubt, default to Inter.

### Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet">
```

### Fallback stacks

```css
/* Inter */
font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;

/* Lora */
font-family: 'Lora', Georgia, 'Times New Roman', serif;
```

### Inter alternate characters (optional polish)

```css
font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
```

### Three roles

| Role | Weight | Size | Tracking | Case | Use |
|---|---|---|---|---|---|
| **Display** | 700 | 32–96px | -0.02em to -0.035em | Sentence | Headlines, hero copy, poster titles |
| **Body** | 400 | 14–18px | 0 | Sentence | All running copy |
| **Label** | 700 | 8–12px | 0.14em to 0.28em | Uppercase | Eyebrow headings only |

### Hierarchy rules

- Default jump is 400 (body) straight to 700 (display). Mid-weights (500, 600) are fine for subtle UI hierarchy.
- Use weight, a gold rule, or italics for emphasis. Don't stack them.
- **No all-caps body copy.** All-caps is for labels and small accents only.
- **Tracking is for eyebrow headings only.** Everywhere else uppercase appears (badges, control labels, in-pill series labels) **defaults to 0 tracking.** Pill buttons can keep ~0.14–0.18em.
- Line-height: 1.02–1.1 for display, 1.55–1.7 for body, 1.15–1.25 for titles.

---

## 4. Logos

### Lockup types

| Type | Use for | File |
|---|---|---|
| **Horizontal** | Default. Headers, footers, anywhere with horizontal room. | `horizontal-{color}.{svg,png}` |
| **Stacked** | Square-ish frames. App icons, social profile images, badges. | `stacked-{color}.{svg,png}` |
| **Wordmark** | The Soteria text alone, no mark. Sub-brand contexts, small chrome. | `wordmark-{color}.{svg,png}` |
| **Logomark** | The six-circle mark alone. Favicons, watermarks, sub-spaces under ~24px. | `logomark-{color}.{svg,png}` |

### Color variants

Each lockup ships in four colors:

| Color | When |
|---|---|
| `navy` (`#1B2A41`) | On light grounds (default) |
| `white` (`#FFFFFF`) | On dark grounds (navy, navy-washed photos, dark gold) |
| `black` (`#000000`) | Grayscale print, single-color reproduction |
| `gold` (`#C2912D`) | Sparingly, when the design specifically calls for a gold mark |

### Clear space

Reserve a margin equal to the **height of the logomark** on all four sides of any lockup. Nothing sits inside that boundary. Official diagram: `logos/logo-whitespace.svg`.

### Minimum size

- **Horizontal lockup**: 120px wide on screen, 0.75" wide in print.
- Below that, switch to the **logomark** (`logomark-{color}.svg`), minimum 24px.
- Favicons: use `favicon-dark.svg` (for light browsers) or `favicon-light.svg` (for dark mode).

### Don'ts

Never:

- **Stretch** — preserve aspect ratio always.
- **Recolor** — only the four official colors. No hue shifts, no tints.
- **Rotate** — always horizontal/vertical, never angled.
- **Drop shadow** — no shadows, glows, or 3D effects.
- **Place on a busy photo** — use a navy wash or pull to white space.
- **Navy on gold** — see Color section. Use white-on-gold or navy-on-white instead.

---

## 5. Photography

When a photo is in a layout, the photo is the message. Type, color, and graphic elements are supporting cast — not competing personalities.

### Treatments

| Treatment | When |
|---|---|
| **Untreated** | Portraits, product shots, detail moments. Full photo, no overlay. |
| **Bottom gradient** | Type sits in the lower third (heroes, sermon series, event posters). |
| **Full navy wash** | Centered type over photo (quote cards, CTA blocks, invitations). |
| **Photo + card** | Photo sits inside a colored ground card. Cards, modules, listings. |

### Rules

- No color overlays except **navy** (for white-text legibility). No gold tints, no duotones, no filters.
- Gold stays in the supporting type only — eyebrows, rules, small accents. **Never on the image.**
- **Type only sits on a photo when a full navy wash or gradient gives white text enough contrast to read.**
- White text on photography. Navy text on light grounds beside photography. **Off-white text never sits on photography** — doesn't hold up on varied backgrounds.
- If the image is strong, the composition around it should be quiet. If the composition is complex, the image should be quiet.

### Photo library

The `branding/photos/` folder is the curated set. ~50 photos covering: worship/preaching, baptism, kids ministry, Sunday services, staff portraits, events, congregational shots. New photos go here when they earn brand-quality. If you add an `INDEX.md` to that folder, list each photo with subject + suitable use (e.g., `lrp-260.jpg — worship, hands raised — heroes, social posts`).

---

## 6. Layout

### Grid

- **Digital**: 8px grid. Spacing values are multiples of 8: 8, 16, 24, 32, 48, 64.
- Arbitrary spacing reads sloppy even when the eye doesn't consciously catch it.

### Whitespace

Every composition should have *significantly* more empty space than feels comfortable. Whitespace is what tells the eye what matters.

### One featured moment (by default)

Most pages work best with one dominant hero — one headline, one featured event, one primary CTA. Long pages can have one primary per section, but within any single moment, keep it to one.

### Alignment

- Left-aligned is the default for body copy and most headlines.
- Centered when the composition is symmetric by design (invitations, scripture cards, some heroes).
- Ragged right is the default over justification.

### Structure

Sections are usually separated by **changes in background color** (white → off-white → navy). The palette does most of the dividing. Rules/dividers/framed cards are allowed when they earn their place; don't reach for them first.

---

## 7. Components

### Buttons

**All buttons are pills (`border-radius: 9999px`).** This is the radius constant for all rounded UI.

#### Primary

```css
border-radius: 9999px;
background: var(--navy);          /* or var(--white) on dark grounds */
color: var(--white);              /* or var(--navy) on dark grounds */
border: 1.5px solid transparent;
padding: 12px 24px;               /* hero scale */
font-size: 14–16px;
font-weight: 600;
letter-spacing: 0;
text-transform: none;             /* Title Case label, not ALL CAPS */
transition: background-color 500ms ease-out,
            color 500ms ease-out,
            border-color 500ms ease-out,
            padding 500ms ease-out;
```

**Hover contract (all pill buttons):** fill drops to transparent, border appears in the rest-fill color, text recolors to match. Padding-right grows ~10px to make room for an icon that slides in from the right edge. Label slides 8px left. Same 500ms ease-out on every property.

Icons: → arrow (most), heart-pin (Plan Your Visit), door (Visit menu), custom glyph (YouTube Subscribe). At rest: hidden (opacity 0, slight offset). On hover: appears at target position.

**One primary button per moment.** Long pages may have a primary per section; within any single moment, keep it to one.

**Button text never wraps.** Use `white-space: nowrap`. Shorten the label if needed.

#### Secondary (outline pill)

Same pill shape and typography. At rest: transparent background, navy text, navy border. On hover: fill inverts to navy, text becomes white.

#### Tertiary (ghost / text link)

Not a pill — just text with a gold underline rule.

```css
color: var(--navy);
border-bottom: 1px solid var(--gold);
font-weight: 600;
padding: 4px 0;
```

#### Underlined text links (rule)

Default treatment: a thin 1px gold hairline at rest (`h-px bg-gold/50`) plus a thicker 2px gold line that draws in from left to right on hover (`h-[2px] w-0 bg-gold transition-[width] duration-500 ease-out group-hover:w-full`).

Skip underlines when interactivity is already obvious: pill buttons, nav structures, cards where the whole card is clickable, icon-led affordances, logo links, text-to-button hover morphs.

Use underlines for inline links in body copy, standalone text CTAs, headings that are also links.

**Gold/yellow text is never a link.** Gold is reserved for non-interactive brand accents.

### Forms

#### Text input

```
Resting: 0.5px solid var(--hairline)
Focused: 1px solid var(--gold)
Filled:  0.5px solid var(--navy)
Error:   1px solid #B43C3C
Background: always white — never tinted
Padding: 0 12px, height 34–40px
```

#### Label

Uppercase, weight 700, letter-spacing 0.16em, color `var(--muted)`, font-size 8–10px, 4px gap above input.

#### Checkbox / Radio

14×14px box (or circle). Unchecked: 1px navy border, white fill. Checked: navy fill, **white** checkmark/dot inside.

#### Toggle/Switch

- Off: track is `rgba(27, 42, 65, 0.15)`, thumb is white with hairline border.
- On: track is navy, thumb is **white**.

#### Slider

- Track: `rgba(27, 42, 65, 0.15)`
- Filled portion: **gold** — the one place gold is allowed inside a small input, because it functions as a rule, not a fill.
- Thumb: solid navy.

#### Select / Dropdown

Caret is gold (`▾`), flipped when open. Option hover: off-white background. Selected option: navy text, off-white background.

### Navigation

#### Top nav (floating glass pill)

- Anchored to the top of the viewport, layered over the hero.
- Layout: wordmark left, menu items center, Plan-Your-Visit pill right.
- At rest: transparent over the hero with a soft 8px backdrop-blur; a low-opacity navy fill (`rgba(27, 42, 65, 0.35)`) becomes visible as the user scrolls.
- Type at rest: `text-sm font-medium` white at 85% opacity, hover restores to 100%.
- **Hover an item → mega menu opens beneath the pill.** A single hairline traces from the item's bottom edge, drops down a measured connection line, then around the panel's border.
- **Scroll compression**: a single spring-smoothed 0→1 progress drives every property (max-width, padding, border-radius, background opacity, blur, logo height, nav gap, CTA scale). After ~400px the nav has compressed from full-width to a centered pill.

#### Mobile nav (hamburger drawer)

- Below `md`: wordmark + hamburger.
- Tap hamburger → drawer slides in from right covering 55–60% of the viewport.
- Drawer ground: navy. Items: white. Current item: 2px gold left rule.
- A single Plan-Your-Visit pill (white fill, navy text) anchors the bottom.
- **No bottom tab bar.** The drawer is the only mobile nav surface.

#### Breadcrumbs

Separator: gold slash (`/`), never chevron. Inactive crumbs: muted. Current crumb: navy bold.

#### Back button

Gold arrow (`←`) + uppercase navy label.

### Containers

- **Cards** — square corners or large fixed radius (per-decision). Hairline border (`0.5px solid var(--hairline)`), no shadows.
- **List rows** — full-width hairline rules between rows. No card framing.
- **Tabs** — 1px gold underline beneath the active tab. Inactive tabs: muted, no underline.

### Feedback

- **Toast / snackbar** — navy fill, white text, gold rule beneath the icon if present.
- **Modal** — white card, hairline border, dim navy-tinted overlay (`rgba(27, 42, 65, 0.55)`).
- **Alert (inline)** — left-aligned, eyebrow label + body. Gold rule for info, error red for destructive.
- **Progress** — gold filled portion on a navy-tinted track.
- **Spinner** — navy outline ring with a gold arc segment.
- **Skeleton** — `rgba(27, 42, 65, 0.08)` (navy tint).
- **Badge** — pill shape, navy fill, white text. Numeric badges may use gold fill with white numerals.

### Recurring patterns

Three patterns earned reuse on the homepage. Reach for them on any new surface before inventing.

#### Hover-overlay reveal

For card-shaped surfaces that swap to an info panel on hover (sermon-series posters, future event cards):

1. **Surface sweep** via `clip-path: inset(0 100% 0 0 round 0 12px 12px 0)` → `inset(0 0 0 0 round 0 12px 12px 0)`, 400ms `ease-out`. Anchor the panel to one edge (left in our case).
2. **Content fade** with `transitionDelay: "200ms"` on the inner div's opacity transition. The stagger is the point.

Surface treatment matches the main nav pill: `bg-navy/55 ring-1 ring-white/10 backdrop-blur-md`.

#### Adaptive line-clamp

When a description sits below a multi-line title in a fixed-height container, the description's `line-clamp` adapts to the title's rendered line count:

| Title lines | Description lines |
|---|---|
| 1 | 7 |
| 2 | 6 |
| 3 | 5 |
| 4 | 4 |
| 5+ | 3 (floor) |

Implementation: `ResizeObserver` on the title node; compute `Math.round(node.clientHeight / parseFloat(getComputedStyle(node).lineHeight))`. Re-measure on `document.fonts.ready`.

#### Custom video player chrome (Mux baseline)

Sermon player chrome lives inside a translucent navy pill — the same surface as the nav and hover-overlay reveal:

- Bottom-anchored playbar pill: `bg-navy/55 backdrop-blur-md border border-white/10 rounded-full`
- Idle controls fade out; cursor wakes them.
- Branded scrub: navy track with **gold** fill segment + gold thumb.
- Custom SVG icons for play, pause, fast-rewind, volume, CC, fullscreen (live at `branding/photos/` is the wrong path — they live at `web/public/graphics/playbar-*.svg`).
- Source is 24fps cinematic — keyframe math should respect that.

### Application UI (product chrome)

The component specs above are drawn for **compositions** — a page with one
hero, one CTA, generous quiet. Product screens (Soteria Assets, admin tools)
have dozens of controls per view, so the same weights read as shouting.
App chrome keeps the brand's silhouette and palette but drops the weight.

**The dial, not a different brand:** pills stay pills, cards stay square and
hairlined, navy/gold/off-white stay the only voices. What changes is border
weight, hover drama, and motion speed.

#### App buttons

| Role | Rest | Hover |
|---|---|---|
| Primary | navy fill, white ink, pill | navy deepens to 90% |
| Secondary | 1px navy-tint border (navy @ 20%), navy ink, transparent fill | border to navy @ 35%, off-white fill |
| Ghost | no border, navy ink | off-white fill |
| Destructive | red fill, white ink | red deepens to 90% |
| Text link | gold underline | ink goes gold |

- **The marketing hover contract (fill → transparent + full border, 500ms)
  is reserved for guest-facing CTA moments** — share landings, the upload
  portal, marketing pages. One per screen, as ever. In app chrome it is
  never used: with many buttons per view the inversion reads as flicker.
- **Motion: 150ms ease-out** in app chrome. 500ms belongs to compositions.
- **Icon buttons** are quiet ghosts: ≥ 32px hit area, off-white circular
  hover. The moment an icon button carries a second glyph (a caret, a
  count), it becomes a **pill with horizontal padding** — never two glyphs
  crammed in a fixed square.

#### App focus & states

- Focus is one gold ring around the **whole interactive row or control** —
  never around an inner text fragment of a composite row.
- Hover/pressed washes are **navy or off-white tints** (e.g. navy @ 5%) —
  never black or gray washes, same as everywhere else in the system.
- Density: app chrome runs 13–14px type; eyebrow labels mark sections.
- **Asset preview grounds use neutral light gray `#F6F6F6`** (the `asset`
  token) — a deliberate exception to "no grays." The warm off-white belongs
  to chrome; a neutral ground doesn't tint the artwork being previewed.
- **Empty sections don't reserve space.** For editors, an empty section
  collapses to one slim row carrying its add action; for viewers it
  disappears entirely.

---

## 8. Voice

Direct, plain, biblical. Avoid AI-flavored two-sentence headlines and "voice should slow down" abstractions. Short titles that say what something *is* and get out of the way.

### We are

- A Baptist church
- A refuge of truth
- A family in mission
- Honest about hard things
- Confident the Bible is true

### We are not

- Hip, edgy, ironic
- Trying to "speak to culture" with clever metaphors
- Using cute prepositional headlines ("On knowing." "On staying.")
- Calling our buildings or programs "experiences"
- Reaching for words like "journey," "unleash," "authentic," "intentional"

### Specifics

- **Service times**: "Sundays at 8:30 and 10:30 AM." Always both. Never "8:30 & 10:30" with ampersand in body copy; in tracked uppercase eyebrows it's fine.
- **Scripture references**: "JOHN 17:3" (uppercase, label-style) when small/eyebrow. "John 17:3" in running body copy.
- **Pastor reference**: First mention "Dr. Mike Augsburger" or "Pastor Mike." Subsequent: "Mike" is fine.
- **Address**: West Des Moines, Iowa. (Never IA in body copy; "IA" is OK in tight labels.)

### Headlines that work

- "Making more & better disciples."
- "There's a seat saved for you."
- "We'd love to meet you this Sunday."
- "Every word of the Bible is true."
- "A refuge of truth. A family in mission."
- "Come as you are."

### Headlines that don't

- "The system, end to end." → too clever / abstract
- "Where the brand lives." / "How the brand thinks." → AI-ish
- "When the image carries." → metaphor-as-headline
- "The hope you've been searching for…" → over-promising
- "Authentic community for the modern believer" → marketing-speak

---

## 9. Accessibility

### Contrast (WCAG AA minimum)

- **Navy on white** — 12.6:1 ✓
- **White on navy** — 12.6:1 ✓
- **Navy on off-white** — 11.5:1 ✓
- **Muted on white** — 5.3:1 ✓ (use for body weight 400+; not for ≤12px below weight 700)
- **Gold on white** — 3.6:1 — passes for large text (≥18pt or ≥14pt bold) only. Don't use gold for body copy.
- **Gold on navy** — 4.4:1 ✓ for large text. Acceptable for eyebrows and rules.

### Focus

- Keyboard focus: 2px `var(--gold)` outline with 2px offset.
- Skip-to-content link: visible on focus only.
- Never remove focus styles. If you replace them, make sure the replacement is at least as visible.

### Semantic HTML

- Use real headings (`<h1>` → `<h6>`) in document order. Don't skip levels for styling.
- Buttons are `<button>`, links are `<a>`. Never `<div onClick>`.
- Form fields always have a `<label for>` association.
- Images: `alt=""` on decorative, descriptive `alt` on content images.

---

## 10. Common mistakes to avoid

1. **Off-white as text.** Off-white is a background-only color.
2. **Navy on gold.** Use white on gold instead.
3. **Gold body text.** Gold is for accents (rules, eyebrows, small marks). Body copy is navy or muted.
4. **Rounded corners on cards bigger than `rounded-full` on buttons.** The radius constant for buttons is `9999px`; cards should be square or use a large fixed radius — don't mix `rounded-md` / `rounded-lg` / `rounded-xl`.
5. **Drop shadows.** Hairlines and color-ground separation handle elevation.
6. **All-caps body copy.** All-caps is for labels only.
7. **Tracking on uppercase outside eyebrows.** Badges, control labels, in-pill series labels all sit at 0 tracking.
8. **Centered everything.** Default is left-aligned; centered is for symmetric compositions.
9. **Multiple primary CTAs in one moment.** One primary per moment.
10. **The logo on a busy photo, or stretched, or recolored.** See Logos section.

---

## 11. Component checklist for any new screen

Before shipping:

- [ ] One primary moment (headline / featured photo / one CTA)
- [ ] White is the dominant ground; navy/off-white are accent grounds
- [ ] Gold appears as a rule, label, or small accent — never as the dominant color
- [ ] Body copy is Inter weight 400 (or Lora where editorial)
- [ ] Display copy is Inter weight 700 with tight tracking
- [ ] All pill buttons follow the hover contract (fill ↔ outline + icon slide-in)
- [ ] One radius constant: `rounded-full` for interactive UI, square / large fixed radius for structural cards
- [ ] Photos either untreated (no overlay) OR have a navy wash/gradient strong enough for white text
- [ ] No gray. No drop shadows. No off-white text.
- [ ] AA contrast checked
- [ ] Focus rings visible
- [ ] Layout still reads at 320px viewport

---

## 12. CSS variable starter

Drop into your global CSS:

```css
:root {
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
  --radius-card: 0;            /* cards default square; per-decision exceptions */

  /* Motion */
  --ease-cta: cubic-bezier(0.4, 0, 0.2, 1);
  --dur-cta: 500ms;
}
```

---

## 13. Summary

**Four colors. Inter + Lora. One primary per moment. White dominates. Navy carries structural weight. Off-white accents with warmth. Gold punctuates — sparingly, always deliberate. Off-white is a background only — navy gets white ink. Type only sits on a photo when there's enough navy wash for white text to read. Photography carries what the system can't, and the system gets out of the way when it does.**

For the live visual reference: <https://branding.soteria.church>
For source files: <https://github.com/joshbyerssoteria/soteria-church> (`branding/` directory)
