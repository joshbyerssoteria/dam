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
