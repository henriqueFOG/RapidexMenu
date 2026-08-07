import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

const baseURL = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const artifactsDir = "playwright-artifacts";
mkdirSync(artifactsDir, { recursive: true });

test.use({ baseURL, viewport: { width: 1440, height: 1000 } });

test("landing aprovada mantém demonstração e pedido real acessíveis", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Cardápio Online/i })).toBeVisible();

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

test("landing aprovada continua responsiva no mobile", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.getByRole("heading", { name: /Cardápio Online/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ver painel funcionando/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Experimentar pedido real/i })).toBeVisible();
  await page.screenshot({ path: `${artifactsDir}/00c-landing-aprovada-mobile.png`, fullPage: true });
  await context.close();
});
