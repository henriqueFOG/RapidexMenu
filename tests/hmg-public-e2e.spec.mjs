import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

const baseURL = process.env.RAPIDEX_E2E_URL || "https://rapidexmenu-hmg.vercel.app";
const artifactsDir = "playwright-public-artifacts";
const rawRunId = process.env.RAPIDEX_PUBLIC_E2E_RUN_ID || `${Date.now()}`;
const suffix = rawRunId.replace(/\D/g, "").slice(-8) || `${Date.now()}`.slice(-8);
const restaurantName = `Rapidex E2E ${suffix}`;
const ownerEmail = `e2e.${suffix}@rapidex-hmg.test`;
const customerEmail = `cliente.${suffix}@rapidex-hmg.test`;
const ownerPhone = `24${(`900000000${suffix}`).slice(-9)}`;
const customerPhone = `24${(`800000000${suffix}`).slice(-9)}`;
const smashName = `Smash E2E ${suffix}`;
const friesName = `Fritas E2E ${suffix}`;
const csv = `categoria;produto;descricao;preco;custo;preparo;emoji;selo\nHambúrgueres;${smashName};Pão brioche, carne e queijo;29,90;11,50;12;🍔;Destaque\nAcompanhamentos;${friesName};Batata crocante;14,90;4,20;8;🍟;Vai bem junto`;

mkdirSync(artifactsDir, { recursive: true });
test.use({ baseURL, viewport: { width: 1440, height: 1000 } });
test.setTimeout(180_000);

test("HMG público: empresa entra, publica cardápio, cliente compra e acompanha até Entregue", async ({ browser }) => {
  const companyContext = await browser.newContext();
  const company = await companyContext.newPage();
  let storePath = "";

  await test.step("empresa se cadastra pelo fluxo público", async () => {
    await company.goto("/cadastro", { waitUntil: "domcontentloaded" });
    await expect(company.getByRole("heading", { name: /Crie sua loja e comece a receber pedidos/i })).toBeVisible();
    await company.locator('input[name="ownerName"]').fill("Mariana E2E Público");
    await company.locator('input[name="restaurantName"]').fill(restaurantName);
    await company.locator('input[name="email"]').fill(ownerEmail);
    await company.locator('input[name="phone"]').fill(ownerPhone);
    await company.locator('input[name="city"]').fill("Petrópolis");
    await company.locator('input[name="state"]').fill("RJ");
    await company.locator('input[name="password"]').fill("RapidexPlaywright123");
    await company.locator('input[name="terms"]').check();
    await company.locator('input[name="privacy"]').check();
    await Promise.all([
      company.waitForURL(/\/onboarding/, { timeout: 30_000 }),
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
    await expect(company.getByText("Dados da operação salvos.")).toBeVisible({ timeout: 20_000 });
  });

  await test.step("empresa importa cardápio pela interface", async () => {
    await company.getByText("Ou colar dados manualmente", { exact: true }).click();
    const textarea = company.getByPlaceholder(/Cole aqui as linhas copiadas do Excel/i);
    await expect(textarea).toBeVisible();
    await textarea.fill(csv);
    await expect(company.getByText("2 produtos", { exact: true })).toBeVisible();
    await expect(company.getByRole("cell", { name: new RegExp(smashName) })).toBeVisible();
    await expect(company.getByRole("cell", { name: new RegExp(friesName) })).toBeVisible();
    await company.getByRole("button", { name: "Importar 2 produtos →" }).click();
    await expect(company.getByText(/2 itens processados/i)).toBeVisible({ timeout: 30_000 });
    await company.screenshot({ path: `${artifactsDir}/01-public-empresa-importou.png`, fullPage: true });
  });

  await test.step("empresa publica e entra no painel real", async () => {
    const publish = company.getByRole("button", { name: "Publicar minha loja →" });
    await expect(publish).toBeEnabled();
    await Promise.all([
      company.waitForURL(/\/assinatura\?welcome=1/, { timeout: 30_000 }),
      publish.click(),
    ]);
    await expect(company.getByRole("heading", { name: "Escolha como quer crescer." })).toBeVisible();
    await Promise.all([
      company.waitForURL(/\/admin/, { timeout: 30_000 }),
      company.getByRole("link", { name: "Continuar meu teste →" }).click(),
    ]);
    await expect(company.getByText(restaurantName).first()).toBeVisible({ timeout: 30_000 });
    const storeLink = company.getByRole("link", { name: /Abrir loja/i });
    await expect(storeLink).toBeVisible();
    storePath = await storeLink.getAttribute("href");
    expect(storePath).toMatch(/^\/loja\//);
    await company.screenshot({ path: `${artifactsDir}/02-public-painel.png`, fullPage: true });
  });

  const consumerContext = await browser.newContext();
  const consumer = await consumerContext.newPage();
  let trackingPath = "";
  let orderNumber = "";

  await test.step("cliente abre a loja publicada e monta o carrinho", async () => {
    await consumer.goto(storePath, { waitUntil: "domcontentloaded" });
    await expect(consumer.getByRole("heading", { name: restaurantName })).toBeVisible({ timeout: 30_000 });
    await expect(consumer.getByText("● Aberto")).toBeVisible();
    const smash = consumer.locator("article").filter({ hasText: smashName });
    const fries = consumer.locator("article").filter({ hasText: friesName });
    await expect(smash).toBeVisible();
    await expect(fries).toBeVisible();
    await smash.getByRole("button", { name: "Adicionar +" }).click();
    await fries.getByRole("button", { name: "Adicionar +" }).click();
    await expect(consumer.getByText("R$ 44,80").first()).toBeVisible();
    await consumer.screenshot({ path: `${artifactsDir}/03-public-cardapio-carrinho.png`, fullPage: true });
  });

  await test.step("cliente conclui o pedido", async () => {
    await consumer.getByRole("button", { name: "Finalizar pedido →" }).click();
    await expect(consumer.getByRole("heading", { name: "Finalizar pedido" })).toBeVisible();
    const checkout = consumer.locator(".rm-checkout");
    await checkout.locator('input[name="name"]').fill(`Cliente E2E ${suffix}`);
    await checkout.locator('input[name="phone"]').fill(customerPhone);
    await checkout.locator('input[name="email"]').fill(customerEmail);
    await checkout.locator('input[name="street"]').fill("Rua do Teste Público");
    await checkout.locator('input[name="number"]').fill("123");
    await checkout.locator('input[name="complement"]').fill("Sala E2E");
    await checkout.locator('input[name="neighborhood"]').fill("Centro");
    await checkout.locator('input[name="postalCode"]').fill("25600000");
    await checkout.locator('input[name="city"]').fill("Petrópolis");
    await checkout.locator('input[name="state"]').fill("RJ");
    await checkout.locator('input[name="payment"][value="card_on_delivery"]').check();
    await consumer.locator(".rm-submit-order").click();
    await expect(consumer.getByText("PEDIDO RECEBIDO")).toBeVisible({ timeout: 30_000 });
    orderNumber = (await consumer.locator(".rm-success-modal h2").innerText()).trim();
    expect(orderNumber).toMatch(/^Pedido #\d+$/);
    trackingPath = await consumer.locator("a.rm-track-link").getAttribute("href");
    expect(trackingPath).toMatch(/^\/acompanhar\//);
    await consumer.screenshot({ path: `${artifactsDir}/04-public-pedido-criado.png`, fullPage: true });
  });

  await test.step("empresa recebe o pedido no painel", async () => {
    await company.reload({ waitUntil: "networkidle" });
    await company.getByRole("button", { name: /Pedidos/ }).click();
    await expect(company.getByText(`Cliente E2E ${suffix}`)).toBeVisible({ timeout: 30_000 });
    await expect(company.getByText(new RegExp(`1× ${smashName}`))).toBeVisible();
    await expect(company.getByText(new RegExp(`1× ${friesName}`))).toBeVisible();
    await company.screenshot({ path: `${artifactsDir}/05-public-empresa-recebeu.png`, fullPage: true });
  });

  await test.step("cliente abre acompanhamento", async () => {
    await consumer.goto(trackingPath, { waitUntil: "domcontentloaded" });
    await expect(consumer.getByRole("heading", { name: orderNumber })).toBeVisible();
    await expect(consumer.locator(".rm-timeline .current").getByText("Pedido recebido")).toBeVisible();
  });

  async function advanceCompany(buttonName, nextButtonName, trackingLabel) {
    const action = company.getByRole("button", { name: buttonName, exact: true });
    await expect(action).toBeVisible({ timeout: 20_000 });
    await action.click();
    if (nextButtonName) {
      await expect(company.getByRole("button", { name: nextButtonName, exact: true })).toBeVisible({ timeout: 20_000 });
    } else {
      await expect(company.getByText("Entregue", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    }
    const refresh = consumer.getByRole("button", { name: /Atualizar agora/i });
    await expect(refresh).toBeEnabled();
    await refresh.click();
    await expect(consumer.locator(".rm-timeline .current").getByText(trackingLabel, { exact: true })).toBeVisible({ timeout: 20_000 });
  }

  await test.step("empresa processa até entrega e cliente vê cada etapa", async () => {
    await advanceCompany("Confirmar", "Iniciar preparo", "Confirmado");
    await advanceCompany("Iniciar preparo", "Marcar pronto", "Na cozinha");
    await advanceCompany("Marcar pronto", "Saiu para entrega", "Pronto");
    await advanceCompany("Saiu para entrega", "Concluir", "Em rota");
    await advanceCompany("Concluir", null, "Entregue");
    await consumer.screenshot({ path: `${artifactsDir}/06-public-cliente-entregue.png`, fullPage: true });
  });

  await test.step("mobile abre a mesma loja sem colisões críticas", async () => {
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const mobile = await mobileContext.newPage();
    await mobile.goto(storePath, { waitUntil: "domcontentloaded" });
    await expect(mobile.getByRole("heading", { name: restaurantName })).toBeVisible();
    await expect(mobile.getByText(smashName)).toBeVisible();
    await expect(mobile.locator(".rm-store-powered")).toContainText(/RapidexMenu/i);
    await expect(mobile.locator(".rmStoreTrust")).toBeHidden();
    await mobile.screenshot({ path: `${artifactsDir}/07-public-cardapio-mobile.png`, fullPage: true });
    await mobileContext.close();
  });

  await companyContext.close();
  await consumerContext.close();
});
