import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";

const baseURL = process.env.RAPIDEX_E2E_URL || "http://localhost:3000";
const adminEmail = "henry.francisco31@hotmail.com";
const adminPassword = process.env.RAPIDEX_PLATFORM_E2E_PASSWORD || "RapidexCentralE2E123";
const suffix = String(Date.now()).slice(-8);
const restaurantName = `Rapidex Central E2E ${suffix}`;
const ownerEmail = `central.owner.${suffix}@rapidex-hmg.test`;
const memberEmail = `central.member.${suffix}@rapidex-hmg.test`;
const artifactsDir = "playwright-platform-admin-artifacts";

mkdirSync(artifactsDir, { recursive: true });
test.use({ baseURL, viewport: { width: 1440, height: 1000 } });
test.setTimeout(180_000);

test("Central gerencia estabelecimento, suporte, segurança e auditoria sem misturar identidades", async ({ browser }) => {
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.get("/api/internal/platform/overview");
  expect(denied.status()).toBe(401);
  const centralAnonymous = await anonymous.request.get("/central", { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(centralAnonymous.status());
  expect(centralAnonymous.headers().location || "").toContain("/central/entrar");
  await anonymous.close();

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/central/entrar", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail administrativo").fill(adminEmail);
  await page.getByLabel("Senha").fill(adminPassword);
  await Promise.all([
    page.waitForURL(/\/central$/, { timeout: 30_000 }),
    page.getByRole("button", { name: /Entrar na Central/i }).click(),
  ]);

  await expect(page.getByText("Central administrativa", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Olá, Henry/i })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Estabelecimentos", exact: true }).click();
  await page.getByRole("button", { name: /Novo estabelecimento/i }).click();
  const create = page.getByRole("heading", { name: "Criar estabelecimento por convite" }).locator("xpath=ancestor::article");
  await create.getByLabel("Estabelecimento").fill(restaurantName);
  await create.getByLabel("Nome do proprietário").fill("Titular Central E2E");
  await create.getByLabel("E-mail exclusivo").fill(ownerEmail);
  await create.getByLabel("Telefone").fill("24912345678");
  await create.getByLabel("Cidade").fill("Petrópolis");
  await create.getByLabel("UF").fill("RJ");
  await create.getByLabel("Motivo").fill("Piloto automatizado da Central administrativa");
  await create.getByRole("button", { name: "Criar e gerar primeiro acesso" }).click();
  await expect(page.getByText(/Estabelecimento criado/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: restaurantName })).toBeVisible();

  const reason = page.getByLabel("Motivo para ações sensíveis");
  await reason.fill("Chamado E2E autorizado pelo titular da loja");
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(page.getByText(/Ação “pausar” concluída/i)).toBeVisible();

  await reason.fill("Bloqueio E2E para confirmar proteção do acesso");
  await page.getByRole("button", { name: "Bloquear", exact: true }).click();
  await expect(page.getByText(/Bloqueado em/i)).toBeVisible();

  await reason.fill("Desbloqueio E2E após validação do atendimento");
  await page.getByRole("button", { name: "Desbloquear", exact: true }).click();
  await expect(page.getByText(/Ação “desbloquear” concluída/i)).toBeVisible();

  const team = page.getByRole("heading", { name: "Equipe do estabelecimento" }).locator("xpath=ancestor::article");
  await reason.fill("Inclusão de operador solicitada pelo proprietário");
  await team.getByLabel("Nome").fill("Operador Central E2E");
  await team.getByLabel("E-mail").fill(memberEmail);
  await team.getByRole("button", { name: "Adicionar membro" }).click();
  await expect(team.getByText(memberEmail, { exact: false })).toBeVisible({ timeout: 20_000 });

  const support = page.getByRole("heading", { name: "Histórico de suporte" }).locator("xpath=ancestor::article");
  await support.getByPlaceholder(/Registre contexto/i).fill("Fluxo administrativo validado sem acessar a senha do titular.");
  await support.getByRole("button", { name: "Registrar nota" }).click();
  await expect(support.getByText(/Fluxo administrativo validado/i)).toBeVisible();

  await page.getByRole("button", { name: "Superadmins", exact: true }).click();
  const adminForm = page.getByRole("heading", { name: "Novo superadmin" }).locator("xpath=ancestor::article");
  await adminForm.getByLabel("Nome completo").fill("Identidade proibida E2E");
  await adminForm.getByLabel("E-mail").fill("heloisa.gall@gmail.com");
  await adminForm.getByLabel("Motivo da concessão").fill("Teste automático da política de identidade");
  await adminForm.getByRole("button", { name: "Cadastrar acesso administrativo" }).click();
  await expect(page.getByText(/não pode ser usado na administração geral/i)).toBeVisible();

  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/internal/platform/audit") && response.ok()),
    page.getByRole("button", { name: "Atualizar dados" }).click(),
  ]);
  await page.getByRole("button", { name: "Auditoria", exact: true }).click();
  await expect(page.getByText("Estabelecimento criado", { exact: true })).toBeVisible();
  await expect(page.getByText("Nota de suporte registrada", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Infraestrutura", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Infraestrutura" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gate para produção" })).toBeVisible();
  await expect(page.getByText("Object storage", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("DATABASE_URL");
  await expect(page.locator("body")).not.toContainText("RAPIDEX_SESSION_SECRET");

  await page.goto("/admin/plataforma", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/central$/);
  await page.screenshot({ path: `${artifactsDir}/platform-admin-console.png`, fullPage: true });
  await context.close();
});