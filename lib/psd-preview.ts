/**
 * Thumbnail extraction for Photoshop documents (.psd/.psb). Server-only:
 * ag-psd is loaded lazily.
 *
 * We pull the small composite JPEG that Photoshop embeds in the file's image
 * resources (max ~160px) rather than decoding the full merged image. The
 * embedded thumbnail is read with `skipCompositeImageData` / `useRawThumbnail`
 * so we never allocate the full-resolution canvas — decoding a 300 MB poster's
 * composite would otherwise blow past the serverless memory limit.
 */

export { isPsd } from "@/lib/file-kinds";

// Composite fallback is only attempted for files small enough to decode
// within the serverless memory budget. The flattened composite of a large
// poster can exceed 1 GB once decoded; the embedded thumbnail does not.
const COMPOSITE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const COMPOSITE_MAX_MEGAPIXELS = 40;

/**
 * Return a thumbnail raster for a PSD/PSB buffer.
 *
 * Prefers the small composite JPEG Photoshop embeds in the file's image
 * resources (cheap, no canvas). PSDs saved without "Maximize Compatibility"
 * carry no embedded thumbnail — for those, if the file is small enough we
 * decode the flattened composite to a PNG instead. Throws when neither is
 * available (callers fall back to the generic-icon path).
 */
export async function renderPsdThumbnail(buffer: Buffer): Promise<Buffer> {
  const { readPsd } = await import("ag-psd");
  const psd = readPsd(buffer, {
    skipLayerImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: false,
    useRawThumbnail: true,
  });
  const raw = psd.imageResources?.thumbnailRaw;
  if (raw?.data) {
    return Buffer.from(raw.data);
  }

  const megapixels = (psd.width * psd.height) / 1_000_000;
  if (buffer.length <= COMPOSITE_MAX_BYTES && megapixels <= COMPOSITE_MAX_MEGAPIXELS) {
    const { initializeCanvas } = await import("ag-psd");
    const { createCanvas } = await import("@napi-rs/canvas");
    initializeCanvas(
      createCanvas as unknown as Parameters<typeof initializeCanvas>[0]
    );
    const full = readPsd(buffer, {
      skipLayerImageData: true,
      skipCompositeImageData: false,
    });
    if (full.canvas) {
      // ag-psd types the canvas as HTMLCanvasElement; the @napi-rs/canvas
      // instance we wired in exposes a Node-style toBuffer().
      const canvas = full.canvas as unknown as {
        toBuffer(mime: "image/png"): Buffer;
      };
      return Buffer.from(canvas.toBuffer("image/png"));
    }
  }

  throw new Error("PSD has no embedded thumbnail or renderable composite");
}
