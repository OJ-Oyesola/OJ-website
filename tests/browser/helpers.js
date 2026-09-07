const { test: base, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const demoBase = "galleries/e5edec8a25350838873d0e638ce864b060c185a80fcd86265789500f527559d5";
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    // Test inquiries must never leave the browser or reach the real Formspree account.
    await page.route("https://formspree.io/**", route => route.fulfill({ status: 503, body: "Test service unavailable" }));
    await page.route("https://cdn.jsdelivr.net/**", route => route.abort());
    await use(page);
    expect(errors, "No uncaught browser errors").toEqual([]);
  }
});

async function fillBooking(page) {
  await page.locator("#f-first").fill("Test");
  await page.locator("#f-last").fill("Client");
  await page.locator("#f-email").fill("test@example.com");
  await page.locator("#f-type").selectOption({ label: "Portrait Session" });
  await page.locator("#f-vision").fill("Automated test — never sent to the real form service.");
}

async function login(page, code = "OJ-DEMO") {
  await page.goto("client.html");
  await page.locator("#g-email").fill("demo@oj-oyesola.com");
  await page.locator("#g-code").fill(code);
  await page.locator("#loginBtn").click();
  await expect(page.locator("#galleryView")).toBeVisible();
}

async function mockZip(page) {
  await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({
    path: path.join(root, "node_modules/jszip/dist/jszip.min.js"),
    contentType: "application/javascript",
    headers: { "access-control-allow-origin": "*" }
  }));
}

async function demoData() {
  return JSON.parse(await fs.readFile(path.join(root, demoBase, "data.json"), "utf8"));
}

module.exports = { test, expect, root, demoBase, fillBooking, login, mockZip, demoData };
