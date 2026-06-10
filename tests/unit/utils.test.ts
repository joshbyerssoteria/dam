import { describe, expect, it } from "vitest";
import { formatBytes, slugify } from "@/lib/utils";
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
