import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

const baseURL = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const artifactsDir = "playwright-artifacts";
mkdirSync(artifactsDir, { recursive: true });

test.use({ baseURL, viewport: { width: 1440, height: 1000 } });

test.setTimeout(120_000);

async function expectPhoneMockWithoutOverlap(page) {
  const openStatus = page.getByText("Aberto agora até 23:00", { exact: true });
  const delivery = page.getByText(/Entrega · 30–50 min · R\$ 5,00/);
  await expect(openStatus).toBeVisible();
  await expect(delivery).toBeVisible();
  const openBox = await openStatus.boundingBox();
  const deliveryBox = await delivery.boundingBox();
  expect(openBox).not.toBeNull();
  expect(deliveryBox).not.toBeNull();
  expect(deliveryBox.y).toBeGreaterThanOrEqual(openBox.y + openBox.height + 2);
}

async function clickLandingRoute(context, label, expectedPath, assertion) {
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  const link = page.getByRole("link", { name: label }).first();
  await expect(link).toBeVisible();
  await expect(link).toBeEnabled();
  await Promise.all([
    page.waitForURL((url) => url.pathname.startsWith(expectedPath), { timeout: 20_000 }),
    link.click(),
  ]);
  await assertion(page);
  await page.close();
}

test("landing oficial é única e todos os CTAs navegam por clique real", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Cardápio Online/i })).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByText(/Seu restaurante vende\. O Rapidex faz o resto\./i)).toHaveCount(0);
  await expectPhoneMockWithoutOverlap(page);
  await page.screenshot({ path: `${artifactsDir}/00-landing-oficial.png`, fullPage: true });

  await clickLandingRoute(page.context(), /Experimentar em tempo real/i, "/loja/serra-burger", async (livePage) => {
    await expect(livePage.getByRole("heading", { name: /Serra Burger/i })).toBeVisible({ timeout: 20_000 });
    await expect(livePage.getByRole("heading", { name: "Smash da Serra", exact: true })).toBeVisible();
    const accent = await livePage.locator(".rm-store").evaluate((element) => getComputedStyle(element).getPropertyValue("--store-accent").trim().toLowerCase());
    expect(accent).toBe("#ff650b");
  });

  await clickLandingRoute(page.context(), /Ver painel funcionando/i, "/demo/painel", async (demoPage) => {
    await expect(demoPage.getByRole("heading", { name: /Boa tarde, Marina/i })).toBeVisible();
    const realOrder = demoPage.getByRole("link", { name: /Experimentar pedido real/i });
    await expect(realOrder).toHaveAttribute("href", "/loja/serra-burger");
    await Promise.all([
      demoPage.waitForURL((url) => url.pathname === "/loja/serra-burger", { timeout: 20_000 }),
      realOrder.click(),
    ]);
    await expect(demoPage.getByRole("heading", { name: /Serra Burger/i })).toBeVisible();
  });

  await clickLandingRoute(page.context(), /Acessar Painel/i, "/entrar", async (loginPage) => {
    await expect(loginPage.getByRole("heading", { name: /Bem-vindo de volta/i })).toBeVisible();
  });

  await clickLandingRoute(page.context(), /Começar agora/i, "/cadastro", async (signupPage) => {
    await expect(signupPage.getByRole("heading", { name: /Crie sua loja/i })).toBeVisible();
  });
});

test("landing oficial mantém clique e mockup íntegros no mobile", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Cardápio Online/i })).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /Acessar Painel/i }).first()).toBeVisible();
  const live = page.locator("a:visible").filter({ hasText: "Experimentar em tempo real" }).first();
  await expect(live).toBeVisible();
  await expect(page.getByRole("link", { name: /Ver painel funcionando/i }).first()).toBeVisible();
  await expectPhoneMockWithoutOverlap(page);
  await page.screenshot({ path: `${artifactsDir}/00c-landing-oficial-mobile.png`, fullPage: true });
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/loja/serra-burger", { timeout: 20_000 }),
    live.click(),
  ]);
  await expect(page.getByRole("heading", { name: /Serra Burger/i })).toBeVisible();
  await expect(page.locator(".rm-store-powered")).toBeVisible();
  await expect(page.locator(".rmStoreTrust")).toBeHidden();
  await context.close();
});
