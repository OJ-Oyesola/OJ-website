const { defineConfig, devices } = require("@playwright/test");
const path = require("node:path");

const baseURL = "http://127.0.0.1:8001/" + encodeURIComponent(path.basename(__dirname)) + "/";

module.exports = defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }
  ],
  webServer: {
    command: "python3 -m http.server 8001 --bind 0.0.0.0 --directory ..",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "ignore"
  }
});
