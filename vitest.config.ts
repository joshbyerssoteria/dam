import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  // Next's string-form PostCSS config isn't valid for Vite — and unit tests
  // never touch CSS anyway.
  css: {
    postcss: { plugins: [] },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
