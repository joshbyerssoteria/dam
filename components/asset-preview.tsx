"use client";

import { useState } from "react";

/** Monochrome document glyph with the file extension centered inside. */
export function FileBadge({ ext }: { ext: string }) {
  return (
    <div className="flex size-full items-center justify-center text-muted-foreground">
      <svg
        viewBox="0 0 56 56"
        className="h-16 w-auto"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M13 5.5h20L45 17.5V48.5a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2v-41a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M33 5.5V17.5h12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <text
          x="27.5"
          y="39"
          textAnchor="middle"
          className="fill-current font-mono"
          fontSize="11"
          fontWeight="600"
          letterSpacing="0.5"
        >
          {ext}
        </text>
      </svg>
    </div>
  );
}

/**
 * Thumbnail image that falls back to a labeled file badge when the preview
 * can't be produced (e.g. a PSD with no embedded thumbnail and no renderable
 * composite) or the file isn't previewable at all.
 */
export function AssetPreview({
  src,
  alt,
  ext,
  previewable,
}: {
  src: string;
  alt: string;
  ext: string;
  previewable: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!previewable || failed) {
    return <FileBadge ext={ext} />;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- authenticated variant route */
    <img
      src={src}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className="size-full object-contain p-4"
    />
  );
}
