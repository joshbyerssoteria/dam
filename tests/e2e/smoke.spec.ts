import { expect, test } from "@playwright/test";

test("login page renders the magic link form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Soteria Assets" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send magic link" })
  ).toBeVisible();
});

test("unauthenticated visitors are redirected to login", async ({ page }) => {
  await page.goto("/photos");
  await expect(page).toHaveURL(/\/login/);
});

test("unknown share token shows not found", async ({ page }) => {
  const response = await page.goto("/f/doesnotexist12345");
  expect(response?.status()).toBe(404);
});
