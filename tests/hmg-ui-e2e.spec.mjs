import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

const baseURL = process.env.RAPIDEX_E2E_URL || "http://127.0.0.1:3000";
const artifactsDir = "playwright-artifacts";
mkdirSync(artifactsDir, { recursive: true });

test.use({ baseURL, viewport: { width: 1440, height: 1000 } });
test.setTimeout(120_000);

test("empresa cadastra produtos, publica, cliente compra e empresa recebe", async ({ browser }) => {
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

  await test.step("empresa cadastra categoria e produtos", async () => {
    await company.locator('input[name="category"]').fill("Hambúrgueres");
    await company.getByRole("button", { name: "+ Categoria" }).click();
    await expect(company.getByText("Categoria criada.")).toBeVisible();

    await company.locator('input[name="product"]').fill("Smash Playwright");
    await company.locator('select[name="categoryId"]').selectOption({ label: "Hambúrgueres" });
    await company.locator('input[name="price"]').fill("29.90");
    await company.locator('input[name="cost"]').fill("10.00");
    await company.locator('input[name="productPrep"]').fill("12");
    await company.locator('input[name="description"]').fill("Pão brioche, carne, queijo e molho da casa.");
    await company.getByRole("button", { name: "+ Adicionar produto" }).click();
    await expect(company.getByText("Produto cadastrado. Seu cardápio já tem conteúdo real.")).toBeVisible();
    await expect(company.getByText("Smash Playwright")).toBeVisible();

    await company.locator('input[name="product"]').fill("Batata Playwright");
    await company.locator('select[name="categoryId"]').selectOption({ label: "Hambúrgueres" });
    await company.locator('input[name="price"]').fill("14.90");
    await company.locator('input[name="cost"]').fill("4.00");
    await company.locator('input[name="productPrep"]').fill("8");
    await company.locator('input[name="description"]').fill("Batata crocante com tempero especial.");
    await company.getByRole("button", { name: "+ Adicionar produto" }).click();
    await expect(company.getByText("Batata Playwright")).toBeVisible();
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
