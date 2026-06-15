import { defineConfig } from "@playwright/test";

// Verificacao visual reproduzivel do dashboard (#13). Roda em desktop + mobile,
// contra um `next start` local (ou BASE_URL externo, ex.: um preview da Vercel).
//
// Uso:
//   npm run build && npm run test:visual           # sobe next start e testa
//   BASE_URL=https://...vercel.app npm run test:visual   # testa um deploy
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const useLocalServer = !process.env.BASE_URL; // BASE_URL externo => nao sobe servidor local

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: useLocalServer
    ? {
        command: process.env.PLAYWRIGHT_WEBSERVER_CMD ?? "npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
