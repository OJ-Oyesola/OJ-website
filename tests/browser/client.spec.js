const { test, expect, root, demoBase, login, mockZip, demoData } = require("./helpers");
const fs = require("node:fs/promises");
const path = require("node:path");
const JSZip = require("jszip");

test("both demo galleries open; selection, clearing and lightbox navigation work", async ({ page }) => {
  await login(page);
  await expect(page.locator(".photo-cell")).toHaveCount(6);
  await page.locator(".photo-cell").first().click();
  await expect(page.locator("#plClose")).toBeFocused();
  await page.locator("#plPrev").click();
  await expect(page.locator("#plCount")).toHaveText("06 / 06");
  await page.locator("#plNext").click();
  await page.locator("#plSelect").click();
  await expect(page.locator("#plSelect")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator(".photo-cell").first()).toBeFocused();
  await expect(page.locator("#abCount")).toHaveText("1 selected");
  await page.locator("#abSelectAll").click();
  await expect(page.locator(".photo-cell.is-selected")).toHaveCount(6);
  await page.locator("#abSelectAll").click();
  await expect(page.locator("#abDownload")).toBeDisabled();
  await page.locator(".photo-cell").first().click();
  await page.locator("#abClear").click();
  await expect(page.locator(".photo-cell.is-selected")).toHaveCount(0);
  await page.locator("#signOut").click();
  await page.locator("#g-email").fill("  DEMO@OJ-OYESOLA.COM  ");
  await page.locator("#g-code").fill("  oj-wedding  ");
  await page.locator("#loginBtn").click();
  await expect(page.locator("#gTitle")).toHaveText("Temi & Chidi");
  await expect(page.locator(".photo-cell")).toHaveCount(8);
});

test("login validates emails and distinguishes missing galleries from connection failures", async ({ page }) => {
  const requests = [];
  page.on("request", request => { if (request.url().endsWith("data.json")) requests.push(request); });
  await page.goto("client.html");
  await page.locator("#g-email").fill("invalid-email");
  await page.locator("#g-code").fill("CODE");
  await page.locator("#loginBtn").click();
  expect(requests).toHaveLength(0);
  await page.route("**/galleries/*/data.json", route => route.fulfill({ status: 404, body: "Not found" }));
  await page.locator("#g-email").fill("unknown@example.com");
  await page.locator("#loginBtn").click();
  await expect(page.locator("#loginErrorMsg")).toContainText("couldn't find a gallery");
  await page.route("**/galleries/*/data.json", route => route.abort());
  await page.locator("#loginBtn").click();
  await expect(page.locator("#loginErrorMsg")).toContainText("check your connection");
  await expect(page.locator("#loginBtn")).toBeEnabled();
});

test("expired galleries do not render photos or enable delivery actions", async ({ page }) => {
  const data = await demoData();
  data.expires = "2020-01-01";
  await page.route("**/galleries/*/data.json", route => route.fulfill({ json: data }));
  const images = [];
  page.on("request", request => { if (/galleries\/.*\/(full|grid)\//.test(request.url())) images.push(request.url()); });
  await login(page);
  await expect(page.locator("#expiredBanner")).toBeVisible();
  await expect(page.locator("#gTools")).toBeHidden();
  await expect(page.locator(".photo-cell")).toHaveCount(0);
  await expect(page.locator("#externalWrap")).toBeHidden();
  expect(images).toEqual([]);
});

test("external galleries show only the external delivery link", async ({ page }) => {
  await page.route("**/galleries/*/data.json", route => route.fulfill({ json: {
    title: "External delivery", externalUrl: "https://example.com/gallery", photos: []
  } }));
  await login(page);
  await expect(page.locator("#externalLink")).toHaveAttribute("href", "https://example.com/gallery");
  await expect(page.locator("#externalWrap")).toBeVisible();
  await expect(page.locator("#gTools")).toBeHidden();
  await expect(page.locator("#gCount")).toBeHidden();
});

test("invalid manifests and executable external links are rejected", async ({ page }) => {
  for (const data of [
    { externalUrl: "javascript:window.injected=true" },
    { photos: [{ grid: "../outside.jpg", full: "full/001.jpg" }] },
    { photos: [], expires: "2026-02-30" }
  ]) {
    await page.route("**/galleries/*/data.json", route => route.fulfill({ json: data }));
    await page.goto("client.html");
    await page.locator("#fillDemo").click();
    await page.locator("#loginBtn").click();
    await expect(page.locator("#loginError")).toBeVisible();
    await expect(page.locator("#galleryView")).toBeHidden();
    expect(await page.evaluate(() => window.injected)).toBeUndefined();
  }
});

test("download all lazy-loads ZIP support and bundles the correct bytes with bounded concurrency", async ({ page }) => {
  await mockZip(page);
  let zipRequests = 0;
  let active = 0;
  let peak = 0;
  page.on("request", request => { if (request.url().includes("jszip.min.js")) zipRequests++; });
  await page.route("**/full/*.jpg", async route => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 100));
    const response = await route.fetch();
    active--;
    await route.fulfill({ response });
  });
  await login(page);
  expect(zipRequests).toBe(0);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#btnDownloadAll").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("the-adewales.zip");
  const archive = await JSZip.loadAsync(await fs.readFile(await download.path()));
  const names = Object.keys(archive.files).filter(name => !archive.files[name].dir);
  expect(names).toHaveLength(6);
  const original = await fs.readFile(path.join(root, demoBase, "full/001.jpg"));
  expect(await archive.file("the-adewales-001.jpg").async("nodebuffer")).toEqual(original);
  expect(zipRequests).toBe(1);
  expect(peak).toBeGreaterThan(1);
  expect(peak).toBeLessThanOrEqual(3);
  await expect(page.locator("#btnDownloadAll")).toBeEnabled();
});

test("one selected photo downloads directly without the ZIP dependency", async ({ page }) => {
  let zipRequests = 0;
  page.on("request", request => { if (request.url().includes("jszip.min.js")) zipRequests++; });
  await login(page);
  await page.locator("#btnSelectMode").click();
  await page.locator(".photo-cell").first().click();
  const downloaded = page.waitForEvent("download");
  await page.locator("#abDownload").click();
  expect((await downloaded).suggestedFilename()).toBe("the-adewales-001.jpg");
  expect(zipRequests).toBe(0);
});

test("a blocked ZIP CDN falls back to consistently named individual downloads", async ({ page }) => {
  const downloads = [];
  page.on("download", download => downloads.push(download.suggestedFilename()));
  await login(page);
  await page.locator("#btnDownloadAll").click();
  await expect(page.locator("#downloadStatus")).toContainText("allow multiple downloads");
  await expect(page.locator("#btnDownloadAll")).toBeEnabled();
  expect(downloads).toEqual(Array.from({ length: 6 }, (_, i) => `the-adewales-${String(i + 1).padStart(3, "0")}.jpg`));
});

test("a failed photo request never produces a partial ZIP and can be retried", async ({ page }) => {
  await mockZip(page);
  await page.route("**/full/002.jpg", route => route.fulfill({ status: 500, body: "Test failure" }));
  const downloads = [];
  page.on("download", download => downloads.push(download));
  await login(page);
  await page.locator("#btnDownloadAll").click();
  await expect(page.locator("#downloadStatus")).toContainText("download was interrupted");
  await expect(page.locator("#btnDownloadAll")).toBeEnabled();
  expect(downloads).toHaveLength(0);
  await page.unroute("**/full/002.jpg");
  const downloaded = page.waitForEvent("download");
  await page.locator("#btnDownloadAll").click();
  expect((await downloaded).suggestedFilename()).toBe("the-adewales.zip");
});

test("signing out cancels an in-flight download before another gallery opens", async ({ page }) => {
  await mockZip(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/full/*.jpg", async route => {
    await gate;
    await route.continue().catch(() => { /* The request may already be cancelled. */ });
  });
  const downloads = [];
  page.on("download", download => downloads.push(download));
  await login(page);
  const started = page.waitForRequest("**/full/*.jpg");
  await page.locator("#btnDownloadAll").click();
  await started;
  await expect(page.locator("#btnDownloadAll")).toBeDisabled();
  await page.locator("#signOut").click();
  release();
  await page.locator("#g-email").fill("demo@oj-oyesola.com");
  await page.locator("#g-code").fill("OJ-WEDDING");
  await page.locator("#loginBtn").click();
  await expect(page.locator("#gTitle")).toHaveText("Temi & Chidi");
  await expect(page.locator("#btnDownloadAll")).toBeEnabled();
  await expect(page.locator("#btnDownloadAll")).toContainText("Download all");
  expect(downloads).toHaveLength(0);
});
