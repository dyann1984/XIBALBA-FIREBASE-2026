import { defineConfig, devices } from "@playwright/test";

const port = process.env.PW_PORT || "3104";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: "es-MX",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "npm.cmd run dev -- --hostname 127.0.0.1 --port 3104",
    env: { PORT: port },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
