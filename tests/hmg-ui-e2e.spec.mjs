import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

const baseURL = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const artifactsDir = "playwright-artifacts";
const menuWorkbookBase64 = "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";
mkdirSync(artifactsDir, { recursive: true });

test.use({ baseURL, viewport: { width: 1440, height: 1000 } });
test.setTimeout(120_000);

test("empresa importa Excel, publica, cliente compra e empresa recebe", async ({ browser }) => {
  const companyContext = await browser.newContext();
  const company = await companyContext.newPage();

  await test.step("empresa cria conta", async () => {
    await company.goto("/cadastro");
    await expect(company.getByRole("heading", { name: /Crie sua loja e comece a receber pedidos/i })).toBeVisible();
    await company.locator('input[name="ownerName"]').fill("Mariana Playwright");
    await company.locator('input[name="restaurantName"]').fill("Playwright Burger HMG");
    await company.locator('input[name="email"]').fill("mariana.playwright@rapidex-hmg.test");
    await company.locator('input[name="phone"]').fill("24999990001");
    await company.locator('input[name="city"]').fill("Petrópolis");
    await company.locator('input[name="state"]').fill("RJ");
    await company.locator('input[name="password"]').fill("RapidexPlaywright123");
    await company.locator('input[name="terms"]').check();
    await company.locator('input[name="privacy"]').check();
    await Promise.all([
      company.waitForURL(/\/onboarding/, { timeout: 20_000 }),
      company.getByRole("button", { name: /Criar minha loja/i }).click(),
    ]);
    await expect(company.getByText(/ATIVAÇÃO DA SUA LOJA/i)).toBeVisible();
  });

  await test.step("empresa configura operação", async () => {
    await company.locator('input[name="deliveryFee"]').fill("5.90");
    await company.locator('input[name="minimumOrder"]').fill("20.00");
    await company.locator('input[name="prep"]').fill("15");
    await company.locator('input[name="delivery"]').fill("25");
    await company.getByRole("button", { name: "Salvar operação" }).click();
    await expect(company.getByText("Dados da operação salvos.")).toBeVisible();
  });

  await test.step("empresa importa produtos de um Excel real", async () => {
    const fileInput = company.locator('input[type="file"][accept*=".xlsx"]');
    await fileInput.setInputFiles({
      name: "cardapio-playwright.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(menuWorkbookBase64, "base64"),
    });
    await expect(company.getByText(/2 produtos/).first()).toBeVisible();
    await expect(company.getByRole("cell", { name: /Smash Playwright/ })).toBeVisible();
    await expect(company.getByRole("cell", { name: /Batata Playwright/ })).toBeVisible();
    await company.getByRole("button", { name: "Importar 2 produtos →" }).click();
    await expect(company.getByText(/2 itens processados/i)).toBeVisible({ timeout: 15_000 });
    await company.screenshot({ path: `${artifactsDir}/01-empresa-onboarding.png`, fullPage: true });
  });

  await test.step("empresa publica a loja e revisa plano", async () => {
    const publish = company.getByRole("button", { name: "Publicar minha loja →" });
    await expect(publish).toBeEnabled();
    await Promise.all([
      company.waitForURL(/\/assinatura\?welcome=1/, { timeout: 20_000 }),
      publish.click(),
    ]);
    await expect(company.getByRole("heading", { name: "Escolha como quer crescer." })).toBeVisible();
    await expect(company.getByText(/A cobrança recorrente ainda não está conectada neste ambiente/i)).toBeVisible();
    await expect(company.getByText("Começo", { exact: true })).toBeVisible();
    await company.screenshot({ path: `${artifactsDir}/01b-empresa-assinatura-hmg.png`, fullPage: true });
    await Promise.all([
      company.waitForURL(/\/admin/, { timeout: 20_000 }),
      company.getByRole("link", { name: "Continuar meu teste →" }).click(),
    ]);
    await expect(company.getByText("Playwright Burger HMG").first()).toBeVisible();
  });

  const consumerContext = await browser.newContext();
  const consumer = await consumerContext.newPage();
  let trackingPath = "";
  let orderNumber = "";

  await test.step("cliente abre cardápio e adiciona produtos", async () => {
    await consumer.goto("/loja/playwright-burger-hmg");
    await expect(consumer.getByRole("heading", { name: "Playwright Burger HMG" })).toBeVisible();
    await expect(consumer.getByText("● Aberto")).toBeVisible();
    const smash = consumer.locator("article").filter({ hasText: "Smash Playwright" });
    const fries = consumer.locator("article").filter({ hasText: "Batata Playwright" });
    await smash.getByRole("button", { name: "Adicionar +" }).click();
    await fries.getByRole("button", { name: "Adicionar +" }).click();
    await expect(consumer.getByText("R$ 44,80").first()).toBeVisible();
    await consumer.screenshot({ path: `${artifactsDir}/02-cliente-cardapio.png`, fullPage: true });

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const mobile = await mobileContext.newPage();
    await mobile.goto("/loja/playwright-burger-hmg");
    await expect(mobile.getByRole("heading", { name: "Playwright Burger HMG" })).toBeVisible();
    await expect(mobile.getByText("Smash Playwright")).toBeVisible();
    await expect(mobile.getByText("Batata Playwright")).toBeVisible();
    await mobile.screenshot({ path: `${artifactsDir}/02b-cliente-cardapio-mobile.png`, fullPage: true });
    await mobileContext.close();
  });

  await test.step("cliente finaliza compra", async () => {
    await consumer.getByRole("button", { name: "Finalizar pedido →" }).click();
    await expect(consumer.getByRole("heading", { name: "Finalizar pedido" })).toBeVisible();
    const checkout = consumer.locator(".rm-checkout");
    await checkout.locator('input[name="name"]').fill("Cliente Playwright");
    await checkout.locator('input[name="phone"]').fill("24988880001");
    await checkout.locator('input[name="email"]').fill("cliente.playwright@rapidex-hmg.test");
    await checkout.locator('input[name="street"]').fill("Rua do Teste E2E");
    await checkout.locator('input[name="number"]').fill("123");
    await checkout.locator('input[name="complement"]').fill("Apto 10");
    await checkout.locator('input[name="neighborhood"]').fill("Centro");
    await checkout.locator('input[name="postalCode"]').fill("25600000");
    await checkout.locator('input[name="city"]').fill("Petrópolis");
    await checkout.locator('input[name="state"]').fill("RJ");
    await checkout.locator('input[name="payment"][value="card_on_delivery"]').check();
    await consumer.locator(".rm-submit-order").click();
    await expect(consumer.getByText("PEDIDO RECEBIDO")).toBeVisible({ timeout: 20_000 });
    const orderHeading = consumer.locator(".rm-success-modal h2");
    orderNumber = (await orderHeading.innerText()).trim();
    expect(orderNumber).toMatch(/^Pedido #\d+$/);
    trackingPath = await consumer.locator("a.rm-track-link").getAttribute("href");
    expect(trackingPath).toMatch(/^\/acompanhar\//);
    await consumer.screenshot({ path: `${artifactsDir}/03-pedido-criado.png`, fullPage: true });
  });

  await test.step("cliente acompanha pedido recebido", async () => {
    await consumer.goto(trackingPath);
    await expect(consumer.getByRole("heading", { name: orderNumber })).toBeVisible();
    await expect(consumer.locator(".rm-timeline .current").getByText("Pedido recebido")).toBeVisible();
  });

  await test.step("empresa confirma que recebeu o pedido", async () => {
    await company.reload({ waitUntil: "networkidle" });
    await company.getByRole("button", { name: /Pedidos/ }).click();
    await expect(company.getByText("Cliente Playwright")).toBeVisible({ timeout: 15_000 });
    await expect(company.getByText(/1× Smash Playwright/)).toBeVisible();
    await expect(company.getByText(/1× Batata Playwright/)).toBeVisible();
    await company.screenshot({ path: `${artifactsDir}/04-empresa-recebeu-pedido.png`, fullPage: true });
  });

  async function advanceCompany(buttonName, expectedTrackingLabel) {
    await company.getByRole("button", { name: buttonName }).click();
    await consumer.getByRole("button", { name: /Atualizar agora/ }).click();
    await expect(consumer.locator(".rm-timeline .current").getByText(expectedTrackingLabel)).toBeVisible({ timeout: 10_000 });
  }

  await test.step("empresa processa pedido até entrega e cliente vê cada etapa", async () => {
    await advanceCompany("Confirmar", "Confirmado");
    await advanceCompany("Iniciar preparo", "Na cozinha");
    await advanceCompany("Marcar pronto", "Pronto");
    await advanceCompany("Saiu para entrega", "Em rota");
    await advanceCompany("Concluir", "Entregue");
    await consumer.screenshot({ path: `${artifactsDir}/05-cliente-entregue.png`, fullPage: true });
  });

  await test.step("painel reflete venda concluída", async () => {
    await company.getByRole("button", { name: "Visão geral" }).click();
    await expect(company.getByText(/1 pedidos/).first()).toBeVisible();
    await expect(company.getByText("R$ 50,70").first()).toBeVisible();
  });

  await companyContext.close();
  await consumerContext.close();
});
