import { describe, expect, it } from "vitest";
import { compareSermonSeriesKits, formatBytes, slugify } from "@/lib/utils";
import { sanitizeFilename } from "@/lib/upload";

describe("slugify", () => {
  it("kebab-cases names", () => {
    expect(slugify("Soteria Brand Kit")).toBe("soteria-brand-kit");
  });

  it("strips punctuation and collapses dashes", () => {
    expect(slugify("Easter — 2026!  (Main)")).toBe("easter-2026-main");
  });

  it("returns empty for symbol-only input", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("formatBytes", () => {
  it("formats across magnitudes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(12 * 1024 * 1024)).toBe("12 MB");
  });
});

describe("compareSermonSeriesKits", () => {
  const kit = (name: string, starts_on: string | null) => ({ name, starts_on });

  it("orders newest start date first", () => {
    const sorted = [
      kit("Mark — Encountering the King", "2026-04-12"),
      kit("Mark — Jesus vs Religion", "2026-07-19"),
    ].sort(compareSermonSeriesKits);
    expect(sorted.map((k) => k.name)).toEqual([
      "Mark — Jesus vs Religion",
      "Mark — Encountering the King",
    ]);
  });

  it("ignores end dates — a missing end date does not pin a series first", () => {
    const sorted = [
      kit("Current (no end date)", "2026-04-12"),
      kit("New series", "2026-07-19"),
    ].sort(compareSermonSeriesKits);
    expect(sorted[0]?.name).toBe("New series");
  });

  it("floats undated kits to the top, ties break by name", () => {
    const sorted = [
      kit("B dated", "2026-01-04"),
      kit("Undated", null),
      kit("A dated", "2026-01-04"),
    ].sort(compareSermonSeriesKits);
    expect(sorted.map((k) => k.name)).toEqual(["Undated", "A dated", "B dated"]);
  });
});

describe("sanitizeFilename", () => {
  it("strips directory traversal", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
  });

  it("replaces unsafe characters", () => {
    expect(sanitizeFilename("my photo (1).jpg")).toBe("my_photo__1_.jpg");
  });

  it("never returns empty", () => {
    expect(sanitizeFilename("///")).toBe("file");
  });
});
