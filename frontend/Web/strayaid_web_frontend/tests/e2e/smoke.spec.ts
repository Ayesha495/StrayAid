import { expect, test } from "@playwright/test";

test("public feed renders with latest updates section", async ({ page }) => {
  await page.goto("/feed");
  await expect(page.getByRole("heading", { name: "Public Feed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest Updates" })).toBeVisible();
});

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});
