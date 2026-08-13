import { test, expect } from "@playwright/test";

const baseURL = process.env.RAPIDEX_E2E_URL || "https://rapidexmenu-hmg.vercel.app";

test.use({ baseURL, viewport: { width: 430, height: 932 } });
test.setTimeout(60_000);

test("PWA HMG: manifest, icons and service worker are valid", async ({ page, request }) => {
  const manifestResponse = await request.get(`${baseURL}/manifest.webmanifest`);
  expect(manifestResponse.ok()).toBeTruthy();
  expect(manifestResponse.headers()["content-type"] || "").toContain("application/manifest");

  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("RapidexMenu");
  expect(manifest.short_name).toBe("Rapidex");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/admin");
  expect(manifest.scope).toBe("/");
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192", type: "image/png" }),
    expect.objectContaining({ sizes: "512x512", type: "image/png" }),
  ]));
  expect(manifest.icons.some((icon) => String(icon.purpose || "").includes("maskable"))).toBeTruthy();

  const iconResponse = await request.get(`${baseURL}/api/pwa/icon/192`);
  expect(iconResponse.ok()).toBeTruthy();
  expect(iconResponse.headers()["content-type"] || "").toContain("image/png");
  expect((await iconResponse.body()).byteLength).toBeGreaterThan(500);

  const workerResponse = await request.get(`${baseURL}/sw.js`);
  expect(workerResponse.ok()).toBeTruthy();
  expect(workerResponse.headers()["content-type"] || "").toContain("javascript");
  expect(workerResponse.headers()["service-worker-allowed"]).toBe("/");
  expect(workerResponse.headers()["cache-control"] || "").toMatch(/no-cache|no-store/);
  const workerSource = await workerResponse.text();
  expect(workerSource).toContain('"/api/"');
  expect(workerSource).toContain('"/admin"');
  expect(workerSource).toContain("if (isNetworkOnly(url.pathname)) return;");

  await page.goto("/offline", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();

  const registration = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return null;
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 10_000)),
    ]);
    if (!ready) return null;
    return {
      scope: ready.scope,
      scriptURL: ready.active?.scriptURL || ready.installing?.scriptURL || ready.waiting?.scriptURL || "",
    };
  });

  expect(registration).not.toBeNull();
  expect(registration.scriptURL).toMatch(/\/sw\.js$/);
  expect(registration.scope).toMatch(/\/$/);
});

test("PWA HMG: perda e retorno de rede ficam visíveis sem repetir mutação", async ({ browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 430, height: 932 } });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await context.setOffline(true);
  await expect(page.getByRole("status").filter({ hasText: "Sem conexão." })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Ações operacionais ficam bloqueadas até a internet voltar/i)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByRole("status").filter({ hasText: "Sem conexão." })).toBeHidden({ timeout: 10_000 });
  await context.close();
});
