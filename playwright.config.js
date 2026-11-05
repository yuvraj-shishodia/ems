import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3011",
    browserName: "chromium",
    channel: "msedge",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node --env-file=.env.test server/index.js",
    url: "http://127.0.0.1:3011/api/health",
    reuseExistingServer: false,
  },
  reporter: "list",
});
