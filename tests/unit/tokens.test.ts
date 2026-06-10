import { describe, expect, it } from "vitest";
import {
  generateShareToken,
  hashPassword,
  isTokenLive,
  verifyPassword,
} from "@/lib/tokens";

describe("generateShareToken", () => {
  it("is 16 chars of the URL-safe alphabet", () => {
    for (let i = 0; i < 50; i += 1) {
      const token = generateShareToken();
      expect(token).toMatch(/^[0-9A-HJ-NP-Za-km-z]{16}$/);
    }
  });

  it("does not repeat", () => {
    const tokens = new Set(
      Array.from({ length: 1000 }, () => generateShareToken())
    );
    expect(tokens.size).toBe(1000);
  });
});

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("hunter2!");
    expect(await verifyPassword("hunter2!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("isTokenLive", () => {
  it("is live with no expiry", () => {
    expect(isTokenLive(null)).toBe(true);
  });

  it("is live before expiry and dead after", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isTokenLive(future)).toBe(true);
    expect(isTokenLive(past)).toBe(false);
  });
});
