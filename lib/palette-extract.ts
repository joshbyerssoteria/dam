/**
 * Probable-palette extraction from a kit's source file (typically a master
 * .ai, which Illustrator saves PDF-compatible). Hybrid approach:
 *   1. Rasterize the first artboard, quantize the pixels with `sharp` to get
 *      pixel-exact candidate hex values + their coverage.
 *   2. Ask Claude vision to name those swatches, assign brand roles, and drop
 *      anti-aliasing / background noise — without inventing new hex values.
 * The result is a *suggestion* the editor reviews before saving. Server-only.
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { z } from "zod";
import { isPdfLike, renderPdfFirstPage } from "@/lib/pdf-preview";

export type SuggestedColor = { hex: string; name: string; role: string };

// Tuning. Coarse quantization + perceptual merge collapses flat brand fills
// into a handful of buckets while edge anti-aliasing spreads thin.
const SAMPLE_DIM = 220; // px the artboard is sampled at
const QUANT_STEP = 16; // channel bucket size
const MERGE_DIST = 30; // RGB euclidean distance to treat two buckets as one
const MIN_COVERAGE = 0.004; // drop speckle below 0.4% of pixels
const MAX_CANDIDATES = 12; // colors handed to the naming step

type Bucket = { r: number; g: number; b: number; n: number };
type Candidate = { hex: string; r: number; g: number; b: number; coverage: number };

function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1]!, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/** Render the source to a PNG we can sample. Throws for unreadable formats. */
async function renderToPng(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<Buffer> {
  if (isPdfLike(mimeType, filename)) {
    return renderPdfFirstPage(buffer, 600);
  }
  if (mimeType.startsWith("image/")) {
    // sharp decodes png/jpg/webp/gif/svg/tiff directly.
    return buffer;
  }
  throw new Error(`Unreadable source type: ${mimeType}`);
}

/** Quantize the artwork into the most prominent distinct colors. */
async function dominantColors(png: Buffer): Promise<Candidate[]> {
  const { data, info } = await sharp(png, { failOn: "none" })
    // PDFs/.ai are usually transparent — composite over white so the page
    // background doesn't read as a color, then drop the alpha channel.
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(SAMPLE_DIM, SAMPLE_DIM, { fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const counts = new Map<string, Bucket>();
  let total = 0;
  for (let i = 0; i + channels - 1 < data.length; i += channels) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    total += 1;
    const key = `${Math.round(r / QUANT_STEP)},${Math.round(g / QUANT_STEP)},${Math.round(b / QUANT_STEP)}`;
    const existing = counts.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.n += 1;
    } else {
      counts.set(key, { r, g, b, n: 1 });
    }
  }
  if (total === 0) return [];

  // Most-frequent first, then absorb perceptual near-duplicates into the
  // earlier (heavier) bucket so anti-aliased edges fold into their flat fill.
  const merged: Bucket[] = [];
  for (const bucket of [...counts.values()].sort((a, b) => b.n - a.n)) {
    const ar = bucket.r / bucket.n;
    const ag = bucket.g / bucket.n;
    const ab = bucket.b / bucket.n;
    const near = merged.find((m) =>
      Math.hypot(m.r / m.n - ar, m.g / m.n - ag, m.b / m.n - ab) < MERGE_DIST
    );
    if (near) {
      near.r += bucket.r;
      near.g += bucket.g;
      near.b += bucket.b;
      near.n += bucket.n;
    } else {
      merged.push({ ...bucket });
    }
  }

  return merged
    .map((m): Candidate => {
      const r = Math.round(m.r / m.n);
      const g = Math.round(m.g / m.n);
      const b = Math.round(m.b / m.n);
      return { hex: rgbToHex(r, g, b), r, g, b, coverage: m.n / total };
    })
    .filter((c) => c.coverage >= MIN_COVERAGE)
    // Drop the page background: near-white that dominates the artboard.
    .filter((c) => !(c.r >= 244 && c.g >= 244 && c.b >= 244 && c.coverage > 0.4))
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, MAX_CANDIDATES);
}

const namedSchema = z.object({
  colors: z.array(
    z.object({
      hex: z.string(),
      name: z.string(),
      role: z.string(),
    })
  ),
});

/** Snap a model-returned hex onto the nearest sampled candidate. */
function snapToCandidate(hex: string, candidates: Candidate[]): Candidate | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  let best: Candidate | null = null;
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const dist = Math.hypot(
      candidate.r - rgb.r,
      candidate.g - rgb.g,
      candidate.b - rgb.b
    );
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

/**
 * Name/role the candidate swatches with Claude vision. Returns null when the
 * API key is absent or the call/parse fails so callers fall back to raw hex.
 */
async function nameSwatches(
  jpegBase64: string,
  candidates: Candidate[]
): Promise<SuggestedColor[] | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const list = candidates
    .map((c) => `${c.hex} (${Math.round(c.coverage * 100)}% of artwork)`)
    .join(", ");
  const prompt = `You are extracting a brand color palette from this artwork (the master design file for a brand kit). These hex colors were sampled from the image, with their coverage: ${list}.

Return ONLY valid JSON of the meaningful brand colors:

{
  "colors": [
    { "hex": "one of the sampled hex values above", "name": "short human color name e.g. Navy, Warm Gold", "role": "brand role if clear: Primary, Secondary, Accent, Neutral, Background — else empty string" }
  ]
}

Rules:
- "hex" MUST be copied from the sampled values above — never invent or adjust a hex.
- Drop colors that are clearly anti-aliasing blends, paper background, or near-duplicates.
- Order by importance to the brand (primary first).
- Keep it to the genuine palette, usually 2-8 colors.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: jpegBase64 },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;
  const raw = textBlock.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");

  let parsed: z.infer<typeof namedSchema>;
  try {
    const result = namedSchema.safeParse(JSON.parse(raw));
    if (!result.success) return null;
    parsed = result.data;
  } catch {
    return null;
  }

  const seen = new Set<string>();
  const colors: SuggestedColor[] = [];
  for (const color of parsed.colors) {
    const snapped = snapToCandidate(color.hex, candidates);
    if (!snapped || seen.has(snapped.hex)) continue;
    seen.add(snapped.hex);
    colors.push({
      hex: snapped.hex,
      name: color.name.trim().slice(0, 80),
      role: color.role.trim().slice(0, 80),
    });
  }
  return colors.length > 0 ? colors : null;
}

/**
 * Suggest a probable palette from a source file buffer. `named` is true when
 * Claude named the swatches, false when we fell back to raw sampled hex.
 */
export async function extractPaletteSuggestion(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<{ colors: SuggestedColor[]; named: boolean }> {
  const png = await renderToPng(buffer, mimeType, filename);
  const candidates = await dominantColors(png);
  if (candidates.length === 0) return { colors: [], named: false };

  let named: SuggestedColor[] | null = null;
  try {
    const jpeg = await sharp(png, { failOn: "none" })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    named = await nameSwatches(jpeg.toString("base64"), candidates);
  } catch {
    named = null;
  }

  if (named) return { colors: named, named: true };
  return {
    colors: candidates
      .slice(0, 8)
      .map((c) => ({ hex: c.hex, name: "", role: "" })),
    named: false,
  };
}
