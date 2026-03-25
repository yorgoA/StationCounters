import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.PW_BASE_URL || "http://localhost:3000",
  },
  webServer: {
    command: "npm run dev -- -p 3000",
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
