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

/**
 * Return the raw embedded-thumbnail JPEG bytes from a PSD/PSB buffer. Throws
 * when the file carries no embedded thumbnail (callers fall back to the
 * generic-icon path).
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
  if (!raw?.data) {
    throw new Error("PSD has no embedded thumbnail");
  }
  return Buffer.from(raw.data);
}
