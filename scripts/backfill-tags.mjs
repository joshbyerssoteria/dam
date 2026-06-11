/**
 * AI-tag every untagged photo in the library, without Inngest: Claude
 * vision (tags/caption/scene/event_type per the SPEC prompt) + OpenAI
 * text-embedding-3-small for the caption embedding, written straight to
 * the photos row.
 *
 * Usage:
 *   node scripts/backfill-tags.mjs           # tag everything untagged
 *   node scripts/backfill-tags.mjs --limit 25   # first N (cost check)
 *   node scripts/backfill-tags.mjs --dry        # count only
 *
 * Resumable: only photos with ai_caption IS NULL are processed, so it can
 * be stopped and re-run freely. Failures are logged and skipped.
 *
 * Required in .env.local: ANTHROPIC_API_KEY, OPENAI_API_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, AWS_*, S3_BUCKET_NAME.
 */

import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import heicConvert from "heic-convert";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

const dryRun = process.argv.includes("--dry");
const limit = process.argv.includes("--limit")
  ? Number(process.argv[process.argv.indexOf("--limit") + 1])
  : null;
const CONCURRENCY = 4;

for (const key of [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "AWS_REGION",
  "S3_BUCKET_NAME",
]) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env.local`);
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const s3 = new S3Client({ region: process.env.AWS_REGION });

/** Retry on rate limits / transient server errors with exponential backoff. */
async function withRetry(label, fn, attempts = 6) {
  let delay = 2000;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      const m = /→ (\d{3})/.exec(error.message);
      const status = m ? Number(m[1]) : 0;
      const retryable = status === 429 || status === 529 || (status >= 500 && status < 600);
      if (!retryable || i === attempts - 1) throw error;
      await new Promise((r) => setTimeout(r, delay + Math.random() * 1000));
      delay = Math.min(delay * 2, 60000);
    }
  }
  throw new Error(`${label}: exhausted retries`);
}

/** HEIC/HEIF magic: an ISO-BMFF "ftyp" box with a heic-family brand. */
function isHeif(buffer) {
  if (buffer.length < 12) return false;
  if (buffer.toString("latin1", 4, 8) !== "ftyp") return false;
  const brand = buffer.toString("latin1", 8, 12);
  return ["heic", "heix", "heif", "mif1", "msf1", "hevc"].includes(brand);
}

/** Resize for Claude vision; transparently decode HEIC first (sharp can't). */
async function toVariantJpeg(original) {
  let source = original;
  if (isHeif(original)) {
    source = Buffer.from(
      await heicConvert({ buffer: original, format: "JPEG", quality: 0.9 })
    );
  }
  // failOn:"none" lets sharp decode truncated/slightly-corrupt JPEGs
  // (common in migrated archives) instead of throwing "premature end".
  return sharp(source, { failOn: "none" })
    .rotate()
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

// Prompt is specified verbatim in SPEC.md — keep in sync with lib/tagging.ts.
const TAGGING_PROMPT = `You are analyzing a photograph from a church event archive for a Digital Asset Management system. Return ONLY valid JSON with these fields:

{
  "tags": ["array of 5-15 specific descriptive tags covering people, actions, settings, objects, mood"],
  "scene": "one-sentence factual description of what is happening",
  "caption": "one descriptive sentence optimized for semantic search — include people, action, setting, emotional tone",
  "event_type": "one of: worship_service, baptism, kids_ministry, students, men, women, conference, fellowship, outdoor, other"
}`;

const EVENT_TYPES = new Set([
  "worship_service", "baptism", "kids_ministry", "students", "men",
  "women", "conference", "fellowship", "outdoor", "other",
]);

async function claudeTag(imageBase64) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: imageBase64 },
            },
            { type: "text", text: TAGGING_PROMPT },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`claude → ${response.status}: ${text.slice(0, 200)}`);
  }
  const json = await response.json();
  const text = json.content?.find((block) => block.type === "text")?.text ?? "";
  const raw = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.tags) || !parsed.caption) {
    throw new Error("malformed tag result");
  }
  return {
    tags: parsed.tags.slice(0, 20).map((tag) => String(tag).toLowerCase()),
    scene: String(parsed.scene ?? ""),
    caption: String(parsed.caption),
    event_type: EVENT_TYPES.has(parsed.event_type) ? parsed.event_type : "other",
  };
}

async function embed(text) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`openai → ${response.status}: ${body.slice(0, 200)}`);
  }
  const json = await response.json();
  return json.data[0].embedding;
}

async function processPhoto(photo) {
  const { data: file } = await supabase
    .from("files")
    .select("s3_bucket, s3_key, mime_type")
    .eq("id", photo.file_id)
    .single();
  if (!file) throw new Error("file row missing");

  const object = await s3.send(
    new GetObjectCommand({ Bucket: file.s3_bucket, Key: file.s3_key })
  );
  const original = Buffer.from(await object.Body.transformToByteArray());
  const variant = await toVariantJpeg(original);

  const result = await withRetry("claude", () => claudeTag(variant.toString("base64")));
  const embedding = await withRetry("openai", () => embed(result.caption));

  const { error } = await supabase
    .from("photos")
    .update({
      ai_tags: result.tags,
      ai_caption: result.caption,
      ai_scene: result.scene,
      event_type: result.event_type,
      embedding: `[${embedding.join(",")}]`,
    })
    .eq("id", photo.id);
  if (error) throw new Error(`update: ${error.message}`);
}

// ---------------------------------------------------------------- run
const { count: total } = await supabase
  .from("photos")
  .select("id", { count: "exact", head: true })
  .is("ai_caption", null);
console.log(`Untagged photos: ${total ?? 0}`);
if (dryRun || !total) process.exit(0);

const target = limit ?? total;
console.log(`Tagging up to ${target} photo(s), concurrency ${CONCURRENCY}…\n`);

let done = 0;
let failed = 0;
const failedIds = [];
const started = Date.now();
// Keyset cursor over (created_at, id): always advances past photos already
// attempted this run, so a failure is never re-fetched and can't clog the
// queue. Prior failures are retried on the next fresh run.
let cursorCreated = null;
let cursorId = null;

while (done + failed < target) {
  let query = supabase
    .from("photos")
    .select("id, file_id, created_at")
    .is("ai_caption", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(CONCURRENCY * 5);
  if (cursorCreated) {
    // (created_at > c) OR (created_at = c AND id > id)
    query = query.or(
      `created_at.gt.${cursorCreated},and(created_at.eq.${cursorCreated},id.gt.${cursorId})`
    );
  }
  const { data: batch, error } = await query;
  if (error) {
    console.error("fetch failed:", error.message);
    break;
  }
  if (!batch || batch.length === 0) break;

  const last = batch[batch.length - 1];
  cursorCreated = last.created_at;
  cursorId = last.id;

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const slice = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(slice.map(processPhoto));
    for (const [index, result] of results.entries()) {
      if (result.status === "fulfilled") {
        done += 1;
      } else {
        failed += 1;
        failedIds.push(slice[index].id);
        console.warn(`  ! photo ${slice[index].id}: ${result.reason?.message}`);
      }
    }
    if ((done + failed) % 100 < CONCURRENCY) {
      const rate = done / ((Date.now() - started) / 60000);
      console.log(
        `  ${done} tagged, ${failed} failed — ${rate.toFixed(0)}/min`
      );
    }
    if (done + failed >= target) break;
  }
}

console.log(`\nDone. Tagged ${done}, failed ${failed}.`);
if (failedIds.length > 0) {
  console.log(`Failed ids (re-run to retry): ${failedIds.slice(0, 25).join(", ")}${failedIds.length > 25 ? `, +${failedIds.length - 25} more` : ""}`);
}
