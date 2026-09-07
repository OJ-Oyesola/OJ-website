const { test, expect, fillBooking } = require("./helpers");

test("invalid inquiries are not remembered as sent", async ({ page }) => {
  await page.goto("index.html");
  await page.locator('#bookingForm button[type="submit"]').click();
  await page.reload();
  await expect(page.locator("#bookingForm")).toBeVisible();
  await expect(page.locator("#formSuccess")).toBeHidden();
});

test("failed inquiries remain retryable after a reload", async ({ page }) => {
  await page.goto("index.html");
  await fillBooking(page);
  await page.locator('#bookingForm button[type="submit"]').click();
  await expect(page.locator("#toast")).toHaveClass(/is-visible/);
  await page.reload();
  await expect(page.locator("#bookingForm")).toBeVisible();
  await expect(page.locator("#formSuccess")).toBeHidden();
});

test("Escape closes only the top gallery layer and keeps the page locked", async ({ page }) => {
  await page.goto("index.html");
  await page.locator(".tile").first().click();
  await expect(page.locator("#collectionView")).toBeVisible();
  await page.locator(".cv-item").first().click();
  await expect(page.locator("#lightbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#lightbox")).toBeHidden();
  await expect(page.locator("#collectionView")).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Escape");
  await expect(page.locator("#collectionView")).toBeHidden();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("homepage still boots without IntersectionObserver", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { delete window.IntersectionObserver; });
  await page.goto("index.html");
  await expect(page.locator("#hero")).toHaveClass(/is-loaded/);
  await expect(page.locator("#masonry .tile")).toHaveCount(20);
  expect(errors).toEqual([]);
});

test("mobile does not fetch the hidden second hero image", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The desktop intentionally displays two frames.");
  await page.goto("index.html");
  await expect(page.locator("#hero")).toHaveClass(/is-loaded/);
  await expect(page.locator(".hero-media__b")).not.toHaveAttribute("src", /.+/);
});

test("signing out resets the gallery selection toolbar", async ({ page }) => {
  await page.goto("client.html");
  await page.locator("#fillDemo").click();
  await page.locator("#loginBtn").click();
  await expect(page.locator("#gTitle")).toHaveText("The Adewales");
  await page.locator("#btnSelectMode").click();
  await page.locator("#signOut").click();
  await page.locator("#fillDemo").click();
  await page.locator("#loginBtn").click();
  await expect(page.locator("#btnSelectMode")).toContainText("Select photos");
  await expect(page.locator("#btnSelectMode")).toHaveAttribute("aria-pressed", "false");
});
