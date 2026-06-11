/**
 * Decode an image buffer into something sharp can resize. Handles HEIC/HEIF
 * (iPhone format — sharp's bundled libvips can't decode it) by converting to
 * JPEG first. Server-only; heic-convert is a WASM module loaded lazily.
 */

import sharp from "sharp";

/** HEIC/HEIF magic: an ISO-BMFF "ftyp" box with a heic-family brand. */
export function isHeifBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer.toString("latin1", 4, 8) !== "ftyp") return false;
  const brand = buffer.toString("latin1", 8, 12);
  return ["heic", "heix", "heif", "mif1", "msf1", "hevc"].includes(brand);
}

/**
 * Return a sharp instance for the buffer, transparently decoding HEIC to
 * JPEG first. `failOn: "none"` lets slightly-corrupt JPEGs (common in
 * migrated archives) still render instead of throwing.
 */
export async function loadImage(buffer: Buffer): Promise<sharp.Sharp> {
  if (isHeifBuffer(buffer)) {
    const heicConvert = (await import("heic-convert")).default;
    const jpeg = Buffer.from(
      await heicConvert({ buffer, format: "JPEG", quality: 0.9 })
    );
    return sharp(jpeg, { failOn: "none" });
  }
  return sharp(buffer, { failOn: "none" });
}
