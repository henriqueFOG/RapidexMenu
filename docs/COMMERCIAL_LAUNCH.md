# RapidexMenu — checklist de lançamento comercial

Este documento separa o que é código do que depende de credenciais/identidade externas. Nunca versionar segredos reais.

## 1. Banco e migrations

A produção comercial usa PostgreSQL. O build Vercel executa migrations pendentes quando `DATABASE_URL` ou `POSTGRES_URL` estiver configurada.

Migrations comerciais:

- `0002_commercial_accounts.sql` — contas, trial e onboarding;
- `0003_platform_billing.sql` — assinatura da plataforma;
- `0004_password_recovery.sql` — recuperação de senha;
- `0005_restaurant_payment_connections.sql` — credenciais de recebimento por restaurante;
- `0006_profit_engine.sql` — atribuição de upsell/recompra e ROI;
- `0007_subscription_access_window.sql` — janela de acesso após cancelamento.

Antes do lançamento, confirmar backup/restauração do PostgreSQL e política de retenção.

## 2. Autenticação comercial

Produção:

- `RAPIDEX_AUTH_MODE=native`
- `RAPIDEX_SESSION_SECRET` com segredo aleatório forte de pelo menos 32 caracteres;
- `RAPIDEX_SIGNUP_ENABLED=true` somente quando o lançamento estiver aprovado.

HMG pode continuar com `RAPIDEX_AUTH_MODE=hmg-access-code` e não deve expor o cadastro comercial.

Validar cadastro, login, logout, reset de senha, 401 sem sessão e isolamento entre tenants.

## 3. Onboarding e ativação

Fluxo obrigatório:

1. `/cadastro`;
2. `/onboarding`;
3. operação e contato;
4. categoria/produto;
5. publicação;
6. `/assinatura` para explicar trial/plano;
7. `/admin`;
8. `/admin/pagamentos` para conectar Mercado Pago se desejar Pix;
9. primeiro pedido público;
10. `/admin/lucro` para medir contribuição/ROI.

Aceite de lançamento: slug único, loja sem produto não publica, preço/custo validados, cardápio não expõe custo, trial expirado bloqueia pedido, cancelamento respeita `access_ends_at` e checkout sem Mercado Pago continua com pagamento na entrega.

## 4. Pagamentos dos restaurantes

O dinheiro dos pedidos não pode usar a credencial da mensalidade Rapidex.

Configurar a aplicação OAuth do Mercado Pago:

- `RAPIDEX_MP_CLIENT_ID`;
- `RAPIDEX_MP_CLIENT_SECRET`;
- `RAPIDEX_INTEGRATION_SECRET` (32+ caracteres);
- redirect URI exatamente igual a `<RAPIDEX_PUBLIC_URL>/api/integrations/mercado-pago/callback`.

Regras: cada restaurante autoriza a própria conta; tokens ficam criptografados; Pix só aparece quando a conexão daquela loja está ativa; desconectar remove Pix dos novos checkouts; nunca usar uma credencial global de vendedor para receber pedidos multiempresa.

## 5. Mensalidade Rapidex

Credencial separada:

- `RAPIDEX_BILLING_MP_ACCESS_TOKEN` da conta da plataforma.

Validar valor, autorização, cancelamento no próprio painel, preservação do período pago, webhook sem encurtar `access_ends_at` e bloqueio de novos pedidos após o período terminar.

## 6. E-mail transacional

Configurar `RESEND_API_KEY` e `RAPIDEX_EMAIL_FROM` com domínio/remetente verificado. Validar recuperação de senha real, expiração em 30 minutos e token de uso único.

## 7. Profit Engine — diferencial comercial

Validar ponta a ponta:

1. cliente adiciona item ao carrinho;
2. `/api/public/recommendations` recebe os produtos escolhidos;
3. recomendação considera margem, histórico de compra conjunta e pressão da cozinha;
4. `upsell_shown` é registrado uma vez por produto/carrinho;
5. produto recomendado aceito entra no pedido com preço recalculado pelo servidor;
6. `upsell_accepted` é registrado separadamente;
7. `/admin/lucro` mostra receita e contribuição atribuídas;
8. faturamento normal não é contado como ROI Rapidex;
9. produto de margem baixa aparece no Guardião de margem;
10. recomendação não funciona para loja com trial/acesso encerrado.

Nunca anunciar ganho garantido. `/calculadora` usa premissas editáveis e deve permanecer explicitamente como simulação.

## 8. WhatsApp, IA e mídia

Só anunciar como ativos depois de credenciais e E2E reais. WhatsApp precisa de credenciais oficiais, consentimento/opt-out e templates quando necessários. IA deve obedecer produto/preço/status reais e transferir alergia, reclamação, cancelamento e reembolso para humano. Upload precisa de storage persistente, limite de arquivo e isolamento por restaurante.

## 9. Jurídico/LGPD

Antes de aceitar clientes pagantes, substituir textos genéricos por dados reais da entidade que opera o RapidexMenu: razão social/nome empresarial, CNPJ se aplicável, endereço/canal de contato, e-mail de privacidade/suporte, responsabilidades controlador/operador, política de retenção e versão/data dos termos. Não inventar esses dados no código.

## 10. Segurança mínima

Rate limit, same-origin, cookies HTTP-only/Secure, segredos fora do Git, revisão de segredos históricos, logs sem dados sensíveis, backup testado, dependências revisadas e CI aprovado.

## 11. CI e deploy

`.github/workflows/ci.yml` executa `npm ci`, `npm run typecheck`, `npm run test:unit` e `npm run build:vercel`.

O PR não deve ser integrado ao `master` enquanto o CI não estiver verde. Se a Vercel estiver bloqueada por limite de builds, não criar commits artificiais para furar limite: usar CI para compilação e a próxima janela disponível para validar runtime/preview.

Depois do CI: preview READY; smoke test de `/`, `/calculadora`, `/cadastro`, `/entrar`, `/onboarding`, `/admin`, `/admin/lucro`, `/admin/pagamentos`, `/assinatura`, `/loja/serra-burger`; E2E empresa -> cardápio -> pedido -> status -> acompanhamento; E2E recomendação -> aceite -> atribuição; E2E cancelamento -> período final; depois merge e produção.

## 12. Critério de pronto para comercializar

- [ ] CI verde;
- [ ] preview/runtime verde;
- [ ] migrations aplicadas sem erro;
- [ ] E2E novo restaurante aprovado;
- [ ] E2E consumidor/pedido aprovado;
- [ ] E2E Profit Engine aprovado;
- [ ] isolamento multiempresa aprovado;
- [ ] pagamentos por vendedor aprovados ou Pix explicitamente desativado;
- [ ] cobrança Rapidex aprovada ou trial sem cobrança explicitamente controlado;
- [ ] e-mail transacional aprovado;
- [ ] termos/privacidade com dados jurídicos reais;
- [ ] credenciais de WhatsApp/IA só prometidas quando realmente ativas;
- [ ] domínio e canais de suporte definidos.
