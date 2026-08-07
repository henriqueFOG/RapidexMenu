import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

const baseURL = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const artifactsDir = "playwright-artifacts";
mkdirSync(artifactsDir, { recursive: true });

test.use({ baseURL, viewport: { width: 1440, height: 1000 } });

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

test("landing oficial é única, estável e expõe todos os caminhos reais", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Cardápio Online/i })).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByText(/Seu restaurante vende\. O Rapidex faz o resto\./i)).toHaveCount(0);
  await expectPhoneMockWithoutOverlap(page);

  const live = page.getByRole("link", { name: /Experimentar em tempo real/i }).first();
  const demo = page.getByRole("link", { name: /Ver painel funcionando/i }).first();
  const panel = page.getByRole("link", { name: /Acessar Painel/i }).first();
  const signup = page.getByRole("link", { name: /Começar agora/i }).first();
  await expect(live).toHaveAttribute("href", "/loja/serra-burger");
  await expect(demo).toHaveAttribute("href", "/demo/painel");
  await expect(panel).toHaveAttribute("href", "/entrar");
  await expect(signup).toHaveAttribute("href", /\/cadastro/);
  await page.screenshot({ path: `${artifactsDir}/00-landing-oficial.png`, fullPage: true });

  const livePage = await page.context().newPage();
  await livePage.goto(new URL(await live.getAttribute("href"), baseURL).toString());
  await expect(livePage.getByRole("heading", { name: /Serra Burger/i })).toBeVisible();
  await livePage.close();

  const demoPage = await page.context().newPage();
  await demoPage.goto(new URL(await demo.getAttribute("href"), baseURL).toString());
  await expect(demoPage.getByRole("heading", { name: /Boa tarde, Marina/i })).toBeVisible();
  await expect(demoPage.getByRole("link", { name: /Experimentar pedido real/i })).toHaveAttribute("href", "/loja/serra-burger");
  await demoPage.close();

  const loginPage = await page.context().newPage();
  await loginPage.goto(new URL(await panel.getAttribute("href"), baseURL).toString());
  await expect(loginPage.getByRole("heading", { name: /Bem-vindo de volta/i })).toBeVisible();
  await loginPage.close();

  const signupPage = await page.context().newPage();
  await signupPage.goto(new URL(await signup.getAttribute("href"), baseURL).toString());
  await expect(signupPage.getByRole("heading", { name: /Crie sua loja/i })).toBeVisible();
  await signupPage.close();
});

test("landing oficial mantém CTAs e mockup íntegros no mobile", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.getByRole("heading", { name: /Cardápio Online/i })).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /Acessar Painel/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Experimentar em tempo real/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Ver painel funcionando/i }).first()).toBeVisible();
  await expectPhoneMockWithoutOverlap(page);
  await page.screenshot({ path: `${artifactsDir}/00c-landing-oficial-mobile.png`, fullPage: true });
  await context.close();
});
