import { describe, expect, it } from "vitest";
import {
  clampTransformWidth,
  isTransformableMime,
  parseTransformFormat,
  transformedFilename,
} from "@/lib/transform";

describe("parseTransformFormat", () => {
  it("accepts supported formats only", () => {
    expect(parseTransformFormat("png")).toBe("png");
    expect(parseTransformFormat("jpg")).toBe("jpg");
    expect(parseTransformFormat("webp")).toBe("webp");
    expect(parseTransformFormat("pdf")).toBeNull();
    expect(parseTransformFormat(null)).toBeNull();
    expect(parseTransformFormat("exe")).toBeNull();
  });
});

describe("isTransformableMime", () => {
  it("accepts svg and common rasters, rejects everything else", () => {
    expect(isTransformableMime("image/svg+xml")).toBe(true);
    expect(isTransformableMime("image/jpeg")).toBe(true);
    expect(isTransformableMime("application/postscript")).toBe(false);
    expect(isTransformableMime("application/pdf")).toBe(false);
    expect(isTransformableMime("font/woff2")).toBe(false);
  });
});

describe("transformedFilename", () => {
  it("swaps extension and notes width", () => {
    expect(transformedFilename("logo.svg", "png", 1200)).toBe("logo-1200w.png");
    expect(transformedFilename("logo.svg", "webp", null)).toBe("logo.webp");
    expect(transformedFilename("noext", "jpg")).toBe("noext.jpg");
  });
});

describe("clampTransformWidth", () => {
  it("clamps to the maximum and rejects junk", () => {
    expect(clampTransformWidth(1200)).toBe(1200);
    expect(clampTransformWidth(999999)).toBe(6000);
    expect(clampTransformWidth(0)).toBeNull();
    expect(clampTransformWidth(null)).toBeNull();
    expect(clampTransformWidth(Number.NaN)).toBeNull();
  });
});
