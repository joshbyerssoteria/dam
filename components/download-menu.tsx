"use client";

import { ChevronDown, Download } from "lucide-react";
import { isPdfLike } from "@/lib/file-kinds";
import { isTransformableMime, TRANSFORM_FORMATS } from "@/lib/transform";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SIZE_OPTIONS = [
  { label: "Full size", width: null },
  { label: "2400 px", width: 2400 },
  { label: "1200 px", width: 1200 },
  { label: "600 px", width: 600 },
] as const;

/**
 * Download options for an asset: the original, plus on-demand format/size
 * conversions for image sources (e.g. SVG → PNG at 1200px).
 */
export function DownloadMenu({
  fileId,
  mimeType,
  filename = "",
  srcPrefix = "/api/files",
  shareToken,
  size = "icon",
}: {
  fileId: string;
  mimeType: string;
  filename?: string;
  srcPrefix?: string;
  shareToken?: string;
  size?: "icon" | "sm";
}) {
  const originalUrl = `${srcPrefix}/${fileId}?download=1`;
  const convertible =
    isTransformableMime(mimeType) || isPdfLike(mimeType, filename);

  function transformUrl(format: string, width: number | null): string {
    const params = new URLSearchParams({ format });
    if (width) params.set("width", String(width));
    if (shareToken) params.set("share", shareToken);
    return `/api/transform/${fileId}?${params.toString()}`;
  }

  if (!convertible) {
    return (
      <Button variant="ghost" size={size} asChild>
        <a href={originalUrl} aria-label="Download original">
          <Download className="size-4" />
          {size === "sm" ? "Download" : null}
        </a>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={size} aria-label="Download options">
          <Download className="size-4" />
          {size === "sm" ? "Download" : null}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <a href={originalUrl}>Original</a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Convert to
        </DropdownMenuLabel>
        {TRANSFORM_FORMATS.map((format) => (
          <DropdownMenuSub key={format}>
            <DropdownMenuSubTrigger className="uppercase">
              {format}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {SIZE_OPTIONS.map((option) => (
                <DropdownMenuItem key={option.label} asChild>
                  <a href={transformUrl(format, option.width)}>{option.label}</a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
