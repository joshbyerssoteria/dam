/** Client-safe file-kind checks (no server deps). */

export function isPdfLike(mimeType: string, filename: string): boolean {
  if (mimeType === "application/pdf") return true;
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  // .ai arrives as application/postscript or octet-stream depending on the
  // uploader; Illustrator saves PDF-compatible by default.
  return (
    ext === "ai" ||
    ext === "pdf" ||
    (mimeType === "application/postscript" && ext !== "eps")
  );
}

/**
 * Web/desktop font files. Served same-origin (not via an S3 redirect) so
 * `@font-face` can load them without cross-origin CORS headers.
 */
export function isFontFile(mimeType: string, filename: string): boolean {
  if (mimeType.startsWith("font/")) return true;
  if (
    [
      "application/font-woff",
      "application/font-woff2",
      "application/x-font-ttf",
      "application/x-font-otf",
      "application/x-font-opentype",
      "application/vnd.ms-opentype",
    ].includes(mimeType)
  ) {
    return true;
  }
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  return ["woff2", "woff", "ttf", "otf"].includes(ext);
}

/** Photoshop documents — previewed via their embedded thumbnail. */
export function isPsd(mimeType: string, filename: string): boolean {
  if (
    mimeType === "image/vnd.adobe.photoshop" ||
    mimeType === "image/x-photoshop" ||
    mimeType === "application/x-photoshop"
  ) {
    return true;
  }
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  return ext === "psd" || ext === "psb";
}
