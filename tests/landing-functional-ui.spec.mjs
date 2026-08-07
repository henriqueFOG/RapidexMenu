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

test("landing aprovada é única, estável e mantém demonstração e pedido real acessíveis", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Cardápio Online/i })).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByText(/Seu restaurante vende\. O Rapidex faz o resto\./i)).toHaveCount(0);
  await expectPhoneMockWithoutOverlap(page);

  const demo = page.getByRole("link", { name: /Ver painel funcionando/i });
  const order = page.getByRole("link", { name: /Experimentar pedido real/i });
  await expect(demo).toHaveAttribute("href", "/demo/painel");
  await expect(order).toHaveAttribute("href", "/loja/serra-burger");
  await page.screenshot({ path: `${artifactsDir}/00-landing-aprovada.png`, fullPage: true });

  await demo.click();
  await expect(page).toHaveURL(/\/demo\/painel/);
  await expect(page.getByRole("heading", { name: /Boa tarde, Marina/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Experimentar pedido real/i })).toHaveAttribute("href", "/loja/serra-burger");
  await page.screenshot({ path: `${artifactsDir}/00b-demo-painel.png`, fullPage: true });

  await page.getByRole("link", { name: /Experimentar pedido real/i }).click();
  await expect(page).toHaveURL(/\/loja\/serra-burger/);
  await expect(page.getByRole("heading", { name: /Serra Burger/i })).toBeVisible();
});

test("landing aprovada continua responsiva no mobile sem sobreposição no mockup", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.getByRole("heading", { name: /Cardápio Online/i })).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /Ver painel funcionando/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Experimentar pedido real/i })).toBeVisible();
  await expectPhoneMockWithoutOverlap(page);
  await page.screenshot({ path: `${artifactsDir}/00c-landing-aprovada-mobile.png`, fullPage: true });
  await context.close();
});
