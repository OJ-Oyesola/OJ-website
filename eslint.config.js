const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: [".venv/**", "playwright-report/**", "test-results/**", "assets/js/galleries.js"] },
  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { "no-unused-vars": ["error", { caughtErrors: "none" }] }
  }
];
