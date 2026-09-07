const { test, expect, root } = require("./helpers");
const fs = require("node:fs/promises");
const path = require("node:path");

test("all collections, categories and featured frames render with reserved image space", async ({ page, isMobile }) => {
  await page.goto("index.html");
  await expect(page.locator("#features .feature")).toHaveCount(3);
  const columns = await page.locator("#features").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(isMobile ? 1 : 3);
  const galleries = await page.evaluate(() => window.OJ_GALLERIES);
  expect(galleries.reduce((n, g) => n + g.photos.length, 0)).toBe(523);
  for (const category of ["portraits", "events", "editorial", "weddings", "commercial", "all"]) {
    const count = galleries.filter(g => category === "all" || g.cat === category).length;
    await page.locator(`[data-filter="${category}"]`).click();
    await expect(page.locator("#masonry .tile:visible")).toHaveCount(count);
    await expect(page.locator("#filterCount")).toHaveText(`${count} ${count === 1 ? "collection" : "collections"}`);
    await expect(page.locator(`[data-filter="${category}"]`)).toHaveAttribute("aria-pressed", "true");
  }
  const dimensions = await page.locator("#masonry img").evaluateAll(images => images.every(img => img.width > 0 && img.height > 0 && img.loading === "lazy"));
  expect(dimensions).toBe(true);
  await page.locator(".tile").first().click();
  await expect(page.locator(".cv-item")).toHaveCount(galleries[0].photos.length);
  expect(await page.locator(".cv-item img").evaluateAll(images => images.every(img => Number(img.getAttribute("width")) > 0 && Number(img.getAttribute("height")) > 0))).toBe(true);
});

test("native gallery dialogs isolate and restore keyboard focus", async ({ page }) => {
  await page.goto("index.html");
  const tile = page.locator(".tile").first();
  await tile.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#cvBack")).toBeFocused();
  const photo = page.locator(".cv-item").first();
  await photo.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#lbClose")).toBeFocused();
  for (const id of ["lbPrev", "lbNext", "lbCta"]) {
    await page.keyboard.press("Tab");
    await expect(page.locator("#" + id)).toBeFocused();
  }
  // Native dialogs may allow focus into browser chrome, but never into the page behind them.
  await page.locator("#cvBack").evaluate(el => el.focus());
  await expect(page.locator("#lbCta")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#lbCount")).toHaveText(/^02 \/ /);
  await page.keyboard.press("Escape");
  await expect(photo).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(tile).toBeFocused();
});

test("booking from the photo viewer closes both layers", async ({ page }) => {
  await page.goto("index.html");
  await page.locator(".tile").first().click();
  await page.locator(".cv-item").first().click();
  await page.locator("#lbCta").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page).toHaveURL(/#contact$/);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("a hero image failure still reveals the heading and booking actions", async ({ page }) => {
  await page.route("**/Hero%20Images/**", route => route.abort());
  await page.route("**/assets/img/hero.jpg", route => route.abort());
  await page.goto("index.html");
  await expect(page.locator("#hero")).toHaveClass(/is-loaded/);
  await expect(page.locator(".hero-media__a")).toHaveAttribute("src", "assets/img/hero.jpg");
  await expect(page.locator(".hero-actions")).toHaveCSS("opacity", "1");
});

test("hero loads the second frame once when a narrow viewport becomes wide", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("index.html");
  await expect(page.locator(".hero-media__b")).not.toHaveAttribute("src", /.+/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".hero-media__b")).toHaveAttribute("src", /.+/);
  const first = await page.locator(".hero-media__a").getAttribute("src");
  const second = await page.locator(".hero-media__b").getAttribute("src");
  expect(first).not.toBe(second);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(".hero-media__b")).toHaveAttribute("src", second);
});

test("mobile menu locks scroll, cycles focus, and closes on desktop resize", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("index.html");
  await page.locator("#navToggle").click();
  await expect(page.locator("#navToggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.locator(".m-cta a").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#navToggle")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#mobileMenu")).toHaveAttribute("inert", "");
  await expect(page.locator("#navToggle")).toBeFocused();
  await page.locator("#navToggle").click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator("#navToggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("FAQ accessibility, testimonials and mobile layout remain intact", async ({ page }) => {
  await page.goto("index.html");
  const questions = page.locator(".faq-q");
  await questions.nth(0).click();
  await expect(questions.nth(0)).toHaveAttribute("aria-expanded", "true");
  await questions.nth(1).click();
  await expect(questions.nth(0)).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#faq-answer-0")).toHaveAttribute("inert", "");
  await expect(page.locator("#faq-answer-1")).toHaveAttribute("aria-hidden", "false");
  await page.locator("#quoteDots button").first().click();
  const fits = await page.evaluate(() => {
    const quote = document.querySelector(".quote.is-active cite").getBoundingClientRect();
    const controls = document.querySelector(".quote-controls").getBoundingClientRect();
    return quote.bottom <= controls.top && document.documentElement.scrollWidth <= document.documentElement.clientWidth;
  });
  expect(fits).toBe(true);
  await page.locator("#quoteNext").click();
  await expect(page.locator("#quoteDots button").nth(1)).toHaveAttribute("aria-pressed", "true");
});

test("reduced-motion users see content and counters without waiting for animations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("index.html");
  expect(await page.locator("[data-count]").evaluateAll(elements => elements.every(el => el.textContent === el.dataset.count))).toBe(true);
  await expect(page.locator(".marquee-track")).toHaveCSS("animation-name", "none");
  await expect(page.locator(".hero-actions")).toHaveCSS("opacity", "1");
});

test("configuration updates contact text as well as destinations", async ({ page }) => {
  await page.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    Object.assign(window.OJ_CONFIG, { email: "new@example.com", whatsapp: "2340000000000", phoneDisplay: "+234 000 000 0000", instagram: "test_handle" });
  }));
  await page.goto("index.html");
  await expect(page.locator(".ci-value[data-email]")).toHaveText("new@example.com");
  await expect(page.locator(".ci-value[data-email]")).toHaveAttribute("href", "mailto:new@example.com");
  await expect(page.locator(".ci-value[data-phone]")).toHaveText("+234 000 000 0000");
  await expect(page.locator("#igContactLink")).toHaveText("@test_handle");
  await expect(page.locator("#igFooterLink")).toHaveAttribute("href", "https://instagram.com/test_handle");
});

test("static pages load their local assets and the nested 404 points home", async ({ page, baseURL }) => {
  const missing = [];
  page.on("response", response => { if (response.status() === 404) missing.push(response.url()); });
  for (const file of ["privacy.html", "terms.html", "contract.html", "404.html"]) {
    await page.goto(file);
    await expect(page.locator("h1")).toBeVisible();
  }
  expect(missing).toEqual([]);
  await page.route("**/missing/deep/page", async route => route.fulfill({
    status: 404, contentType: "text/html", body: await fs.readFile(path.join(root, "404.html"), "utf8")
  }));
  await page.goto("missing/deep/page");
  await expect(page.locator(".nf a")).toHaveJSProperty("href", new URL("index.html", baseURL).href);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(20, 17, 12)");
});


test("all pages fit narrow screens after the brand fonts load", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const file of ["index.html", "client.html", "contract.html", "privacy.html", "terms.html", "404.html"]) {
      await page.goto(file);
      await page.evaluate(() => document.fonts.ready);
      const dimensions = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth
      }));
      expect(dimensions.content, `${file} at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    }
  }
});
