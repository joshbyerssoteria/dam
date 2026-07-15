import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(typeof date === "string" ? new Date(date) : date);
}

/** Parse a YYYY-MM-DD date string as a local date (no timezone shift). */
function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/**
 * Format a sermon-series date range, e.g. "Jan 5 – Feb 9, 2026". The year is
 * dropped from the start date when both ends share it. Returns null when there
 * is nothing to show.
 */
export function formatDateRange(
  starts: string | null,
  ends: string | null
): string | null {
  const start = starts ? parseDateOnly(starts) : null;
  const end = ends ? parseDateOnly(ends) : null;
  if (!start && !end) return null;

  const full = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const noYear = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  if (start && end) {
    const sameYear = start.getFullYear() === end.getFullYear();
    return `${(sameYear ? noYear : full).format(start)} – ${full.format(end)}`;
  }
  return full.format((start ?? end) as Date);
}

/**
 * Display order for kits inside the Sermon Series folder: newest series first
 * by start date, undated kits (not yet scheduled) on top, ties by name.
 * Dates own the order there — manual drag ordering does not apply.
 */
export function compareSermonSeriesKits(
  a: { name: string; starts_on: string | null },
  b: { name: string; starts_on: string | null }
): number {
  if (a.starts_on !== b.starts_on) {
    if (!a.starts_on) return -1;
    if (!b.starts_on) return 1;
    // YYYY-MM-DD strings compare correctly lexicographically.
    return b.starts_on.localeCompare(a.starts_on);
  }
  return a.name.localeCompare(b.name);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
