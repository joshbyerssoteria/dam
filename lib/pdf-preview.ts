/**
 * First-page rasterization for PDF-like files (PDF, and .ai files saved
 * with PDF compatibility — Illustrator's default). Server-only: mupdf is a
 * ~13MB WASM module, loaded lazily on first use.
 */

export { isPdfLike } from "@/lib/file-kinds";

/**
 * Render the first page/artboard to a PNG buffer at roughly the requested
 * pixel width. Throws if the buffer isn't PDF-compatible (legacy .ai) —
 * callers fall back to their generic-icon path.
 */
export async function renderPdfFirstPage(
  buffer: Buffer,
  targetWidth: number
): Promise<Buffer> {
  const mupdf = await import("mupdf");
  const document = mupdf.Document.openDocument(
    new Uint8Array(buffer),
    "application/pdf"
  );
  try {
    const page = document.loadPage(0);
    const [x0, , x1] = page.getBounds();
    const pageWidth = Math.max(x1 - x0, 1);
    const scale = Math.min(Math.max(targetWidth / pageWidth, 0.1), 8);
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(scale, scale),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true
    );
    const png = Buffer.from(pixmap.asPNG());
    pixmap.destroy();
    return png;
  } finally {
    document.destroy();
  }
}
