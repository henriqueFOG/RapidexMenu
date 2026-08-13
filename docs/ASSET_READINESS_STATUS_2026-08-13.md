# RapidexMenu — status de execução do checklist

Data: 13/08/2026  
Branch: `agent/commercial-hardening-p0`  
PR: #8 (draft → `hmg`)

## Legenda

- ✅ implementado com gate automático já observado verde em algum head desta execução;
- 🧪 implementado, mas precisa do E2E/HMG final do head consolidado;
- ⏳ pendente técnico;
- 🔒 depende de conta, fornecedor, jurídico, estrutura empresarial ou evidência externa.

## P0 — integridade / segurança

- 🧪 lock/guard de estoque no PostgreSQL e erro comercial de conflito;
- 🧪 compare-and-set de status de pedido;
- ✅ preço base server-side + idempotência preexistentes preservados;
- 🧪 CSP/security headers/CSRF reforçados;
- ✅ entitlements unitários passaram no CI em head anterior desta execução;
- 🧪 Dependabot + npm audit + scan de segredos adicionados; validar workflows no head consolidado;
- 🧪 magic bytes/dimensões de imagem + testes unitários adicionados;
- ⏳ re-encode de mídia e object storage definitivo;
- 🔒 revisão de segurança externa e rotação de segredos históricos.

## P0 — produto universal

- 🧪 delivery / pickup / dine-in modelados no pedido;
- 🧪 configuração de modalidades no onboarding e Operação;
- 🧪 mesa obrigatória no dine-in; endereço/frete só no delivery;
- 🧪 grupos de opções com min/max;
- 🧪 tamanhos/sabores/adicionais com preço/custo server-side;
- 🧪 estratégias de preço `sum`, `highest`, `average`, `included`;
- 🧪 snapshot imutável de opções no pedido;
- 🧪 editor no-code `/admin/opcoes`;
- 🧪 KDS operacional `/admin/cozinha` restrito ao Scale;
- ⏳ KDS por estação/fila preditiva;
- ⏳ pedido agendado (coluna preparada, fluxo ainda não concluído).

## P0 — entrega

- 🧪 zonas por prefixo de CEP/bairro;
- 🧪 frete, mínimo e minutos extras por zona;
- 🧪 modo restrito à cobertura e bloqueio fora da área;
- 🧪 cotação pública rate-limited e server-side;
- 🧪 snapshot da zona aplicada no pedido;
- 🧪 editor `/admin/entrega`;
- ⏳ integrar a cotação dinâmica ao total exibido no checkout antes da confirmação final (servidor já cobra corretamente);
- ⏳ polígonos/raio e parceiro logístico somente após validação de demanda.

## P0 — pagamentos e billing

- ✅ verificação do provedor no webhook já existia;
- 🧪 lógica de reconciliação de Pix independente do webhook;
- 🧪 endpoint protegido de reconciliação + Cron Vercel a cada 15 min no código;
- 🔒 configurar `CRON_SECRET` no ambiente e validar execução real;
- 🧪 grace period de 72h para interrupção de renovação (sem conceder extra a cancelamento voluntário além do período pago);
- 🧪 endpoint protegido para reconciliar assinaturas;
- ⏳ agendar também reconciliação de assinaturas no ambiente consolidado;
- ⏳ dunning por e-mail e métricas de inadimplência;
- 🔒 validar assinatura/renovação/recusa/cancelamento com conta Mercado Pago definitiva.

## P0 — LGPD / jurídico

- 🧪 versão centralizada de Termos/Privacidade + aceite persistido;
- 🧪 exportação de dados do cliente auditada;
- 🧪 correção de nome/e-mail via API tenant-safe;
- 🧪 opt-out imediato e persistente;
- 🧪 fila de solicitações de acesso/portabilidade/eliminação;
- 🧪 eliminação destrutiva deliberadamente bloqueada até revisão de retenção/base legal;
- 🧪 painel `/admin/privacidade`;
- 🔒 revisão jurídica brasileira de Termos/Privacidade/DPA;
- 🔒 papel controlador/operador, subprocessadores e transferências internacionais;
- ⏳ política/rotina de retenção aprovada e implementada.

## P0/P1 — operação do SaaS

- 🧪 backoffice `/admin/plataforma` restrito ao `RAPIDEX_OWNER_EMAIL`;
- 🧪 métricas de restaurantes, publicados, ativação, ativação ≤48h, trials, pagantes, MRR e ARR run-rate;
- 🧪 saúde resumida de integrações por tenant;
- ✅ runbook de piloto já existia;
- ✅ sistema operacional comercial documentado nesta execução;
- ✅ severidade/incidentes/SLA interno documentado nesta execução;
- ✅ registro de ativos/contas e gates externos documentados nesta execução;
- ⏳ error tracking/APM/uptime externo e alertas;
- ⏳ fila assíncrona/retries/DLQ para integrações.

## P1/P2 — ainda bloqueadores de escala

- ⏳ organização + multiunidade real com unidade ativa e billing compartilhado;
- ⏳ CRM/segmentação/recompra automatizada com frequency cap;
- ⏳ cache/invalidação do catálogo e load tests;
- ⏳ PWA/KDS tablet aprimorado;
- ⏳ POS/ERP/fiscal/logística/API pública;
- ⏳ MRR expansion/contraction, churn, NRR, CAC, payback e LTV/CAC instrumentados historicamente;
- 🔒 titularidade empresarial, marca, domínios, contas, MFA e cessão de PI;
- 🔒 restore real + RPO/RTO;
- 🔒 Meta/WhatsApp, Mercado Pago, e-mail, OpenAI e storage de produção validados com credenciais reais.

## Gate atual

O PR permanece **draft**. Não deve ser mergeado em `hmg` enquanto o head consolidado não tiver:

1. TypeScript + unit tests + build verdes;
2. migrations 0011+ aplicadas em PostgreSQL isolado;
3. E2E comercial completo verde (modalidades, modificadores, zonas, concorrência, tracking, isolamento);
4. validação do HMG público do mesmo SHA;
5. revisão dos workflows de audit/secret scan.

Itens externos continuam fora do escopo de “concluído” até existir evidência real.
