const { test, expect, fillBooking } = require("./helpers");

test("only a confirmed response is remembered; native form fields are serialized correctly", async ({ page }) => {
  let submissions = 0;
  let payload;
  await page.route("https://formspree.io/**", async route => {
    submissions++;
    payload = route.request().postDataJSON();
    await new Promise(resolve => setTimeout(resolve, 200));
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("index.html");
  await fillBooking(page);
  await page.locator("#bookingForm").evaluate(form => {
    for (const [name, value, disabled] of [["extra", "one", false], ["extra", "two", false], ["ignored", "disabled", true], ["_gotcha", "", false]]) {
      const input = document.createElement("input");
      Object.assign(input, { name, value, disabled });
      form.append(input);
    }
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.locator("#formSuccess")).toBeVisible();
  await expect(page.locator("#formSuccess")).toBeFocused();
  expect(submissions).toBe(1);
  expect(payload).toMatchObject({ first_name: "Test", email: "test@example.com", extra: ["one", "two"], _gotcha: "" });
  expect(payload).not.toHaveProperty("ignored");
  expect(await page.evaluate(() => localStorage.getItem("oj_inquiry_confirmed"))).toBe("1");
  await page.reload();
  await expect(page.locator("#formSuccess")).toBeVisible();
  await page.locator("#sendAnother").click();
  await expect(page.locator("#bookingForm")).toBeVisible();
  await expect(page.locator("#f-first")).toBeFocused();
  await expect(page.locator("#f-first")).toHaveValue("");
  expect(await page.evaluate(() => localStorage.getItem("oj_inquiry_confirmed"))).toBeNull();
});

test("legacy unconfirmed flags do not hide the inquiry form", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oj_inquiry_sent", "1"));
  await page.goto("index.html");
  await expect(page.locator("#bookingForm")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("oj_inquiry_sent"))).toBeNull();
});

test("email fallback leaves details editable and does not claim delivery", async ({ page }) => {
  await page.goto("index.html");
  await page.evaluate(() => { window.OJ_CONFIG.formspreeId = ""; });
  await fillBooking(page);
  await page.locator('#bookingForm button[type="submit"]').click();
  await expect(page.locator("#toast")).toContainText("Please send the draft");
  await expect(page.locator("#formSuccess")).toBeHidden();
  await expect(page.locator("#bookingForm")).toBeVisible();
  await expect(page.locator("#f-email")).toHaveValue("test@example.com");
  expect(await page.evaluate(() => localStorage.getItem("oj_inquiry_confirmed"))).toBeNull();
});

test("offline form errors restore the button without discarding the inquiry", async ({ page }) => {
  await page.route("https://formspree.io/**", route => route.abort());
  await page.goto("index.html");
  await fillBooking(page);
  await page.locator('#bookingForm button[type="submit"]').click();
  await expect(page.locator("#toast")).toContainText("Delivery wasn't confirmed");
  await expect(page.locator('#bookingForm button[type="submit"]')).toBeEnabled();
  await expect(page.locator("#f-first")).toHaveValue("Test");
  await expect(page.locator("#formSuccess")).toBeHidden();
});

test("blocked storage does not prevent a successful submission", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage blocked"); } });
  });
  await page.route("https://formspree.io/**", route => route.fulfill({ json: { ok: true } }));
  await page.goto("index.html");
  await fillBooking(page);
  await page.locator('#bookingForm button[type="submit"]').click();
  await expect(page.locator("#formSuccess")).toBeVisible();
});

test("contract signature and required consent are submitted only once valid", async ({ page }) => {
  let payload;
  await page.route("https://formspree.io/**", route => {
    payload = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("contract.html");
  await page.locator("#c-first").fill("Test");
  await page.locator("#c-last").fill("Client");
  await page.locator("#c-email").fill("test@example.com");
  await page.locator("#c-type").selectOption({ label: "Portrait Session" });
  await page.locator("#c-date").fill("2027-01-01");
  await page.locator("#c-sig").fill("Test Client");
  await expect(page.locator("#sigPreview")).toHaveText("Test Client");
  await page.locator('#contractForm button[type="submit"]').click();
  expect(payload).toBeUndefined();
  await page.locator("#c-consent").check();
  await page.locator('#contractForm button[type="submit"]').click();
  await expect(page.locator("#contractSuccess")).toBeVisible();
  expect(payload).toMatchObject({ typed_signature: "Test Client", consent: "agreed", session_date: "2027-01-01" });
});
