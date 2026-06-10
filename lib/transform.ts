export const TRANSFORM_FORMATS = ["png", "jpg", "webp"] as const;
export type TransformFormat = (typeof TRANSFORM_FORMATS)[number];

export function parseTransformFormat(value: string | null): TransformFormat | null {
  return (TRANSFORM_FORMATS as readonly string[]).includes(value ?? "")
    ? (value as TransformFormat)
    : null;
}

export const TRANSFORM_CONTENT_TYPES: Record<TransformFormat, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

/** Mime types the transform pipeline can read. */
export function isTransformableMime(mimeType: string): boolean {
  return [
    "image/svg+xml",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/tiff",
    "image/avif",
  ].includes(mimeType);
}

export function transformedFilename(
  originalFilename: string,
  format: TransformFormat,
  width?: number | null
): string {
  const base = originalFilename.replace(/\.[^.]+$/, "") || "image";
  return width ? `${base}-${width}w.${format}` : `${base}.${format}`;
}

export const MAX_TRANSFORM_WIDTH = 6000;

export function clampTransformWidth(value: number | null): number | null {
  if (!value || Number.isNaN(value) || value <= 0) return null;
  return Math.min(Math.round(value), MAX_TRANSFORM_WIDTH);
}
