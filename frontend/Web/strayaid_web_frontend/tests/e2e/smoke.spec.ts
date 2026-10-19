import { expect, test } from "@playwright/test";

test("landing page explains StrayAid and links to the animals", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Help injured strays reach a rescue team/ })).toBeVisible();
  await page.getByRole("link", { name: /Meet the animals/ }).click();
  await expect(page).toHaveURL(/\/animals\/browse/);
  await expect(page.getByRole("heading", { name: "Animals", level: 1 })).toBeVisible();
});

test("guests can read the community feed", async ({ page }) => {
  await page.goto("/feed");
  await expect(page.getByRole("heading", { name: "Community" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
});

test("organization pages send guests to log in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
