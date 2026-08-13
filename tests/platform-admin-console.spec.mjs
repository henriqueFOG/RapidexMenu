import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

const baseURL = process.env.RAPIDEX_E2E_URL || "http://localhost:3000";
const adminEmail = process.env.RAPIDEX_OWNER_EMAIL || "platform.admin@rapidex-hmg.test";
const restaurantName = "Rapidex Platform Admin E2E";
const artifactsDir = "playwright-platform-admin-artifacts";

mkdirSync(artifactsDir, { recursive: true });
test.use({ baseURL, viewport: { width: 1440, height: 1000 } });
test.setTimeout(120_000);

test("central da plataforma é exclusiva do admin e mostra gestão do SaaS", async ({ browser }) => {
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.get("/api/internal/platform/overview");
  expect(denied.status()).toBe(401);
  await anonymous.close();

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/cadastro", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="ownerName"]').fill("Admin Rapidex E2E");
  await page.locator('input[name="restaurantName"]').fill(restaurantName);
  await page.locator('input[name="email"]').fill(adminEmail);
  await page.locator('input[name="phone"]').fill("24911112222");
  await page.locator('input[name="city"]').fill("Petrópolis");
  await page.locator('input[name="state"]').fill("RJ");
  await page.locator('input[name="password"]').fill("RapidexAdmin123");
  await page.locator('input[name="terms"]').check();
  await page.locator('input[name="privacy"]').check();
  await Promise.all([
    page.waitForURL(/\/onboarding/, { timeout: 30_000 }),
    page.getByRole("button", { name: /Criar minha loja/i }).click(),
  ]);

  await page.goto("/admin/plataforma", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Central de gerenciamento" })).toBeVisible();
  await expect(page.getByText("ADMINISTRAÇÃO DA PLATAFORMA")).toBeVisible();
  await expect(page.getByRole("button", { name: "Visão geral" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restaurantes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Receita" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Operação" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Infraestrutura" })).toBeVisible();

  const overview = await page.evaluate(async () => {
    const response = await fetch("/api/internal/platform/overview", { cache: "no-store" });
    return { status: response.status, body: await response.json() };
  });
  expect(overview.status).toBe(200);
  expect(overview.body.metrics.restaurants).toBeGreaterThanOrEqual(1);

  await page.getByRole("button", { name: "Restaurantes" }).click();
  await expect(page.getByText(restaurantName)).toBeVisible();
  await page.getByRole("button", { name: "Infraestrutura" }).click();
  await expect(page.getByText("Banco", { exact: true })).toBeVisible();
  await expect(page.getByText("Integrações", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("DATABASE_URL");
  await expect(page.locator("body")).not.toContainText("RAPIDEX_SESSION_SECRET");
  await page.screenshot({ path: `${artifactsDir}/platform-admin-console.png`, fullPage: true });
  await context.close();
});
