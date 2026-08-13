# RapidexMenu — Checklist vivo de prontidão comercial

Atualizado em 13/08/2026. Este documento é o gate operacional do produto; presença de código, por si só, não significa prontidão comercial.

## Legenda

- ✅ implementado e já validado por teste/gate técnico aplicável.
- 🧪 implementado no branch de hardening, aguardando ou repetindo validação no SHA final.
- ⏳ trabalho técnico ainda pendente para a fase indicada.
- 🔒 dependência externa/empresarial que não pode ser concluída apenas por código.
- ➡️ deliberadamente movido para fase posterior porque não faz parte da oferta comercial atual.

---

# P0 — necessário para piloto comercial confiável

## 1. Integridade de pedidos e concorrência

- ✅ Preço e custo do pedido recalculados no servidor; preço enviado pelo navegador não é autoridade.
- ✅ Idempotência de checkout por `clientOrderId` + restrição única por restaurante.
- ✅ Reserva/decremento de estoque protegidos no PostgreSQL por lock transacional.
- ✅ Falha de corrida de estoque traduzida para `409 insufficient_stock`, sem pedido parcialmente confirmado.
- ✅ E2E PostgreSQL com duas compras disputando a última unidade.
- ✅ Mudança de status com compare-and-set; operador com estado antigo recebe `409 order_state_conflict`.
- ✅ E2E PostgreSQL para duas transições concorrentes do mesmo pedido.
- 🧪 Numeração de pedidos: teste com 12 checkouts simultâneos adicionado; primeiro run provou que o rate-limit funcionava e foi isolado em bucket próprio para testar a sequência sem desabilitar a proteção de produção.
- ✅ Isolamento multi-tenant adversarial para produtos, mídia, pedidos e clientes.

**Aceite:** nenhum overselling silencioso, colisão de status ou acesso cruzado entre restaurantes.

## 2. Pagamentos do restaurante

- ✅ Pix/checkout não confia no payload do webhook: pagamento é reconsultado no Mercado Pago antes de alterar estado.
- ✅ Webhook/idempotência e associação de pagamento ao pedido/tenant.
- ✅ Job de reconciliação de pagamentos pendentes implementado.
- ✅ Cron protegido por Bearer secret e compatível com `CRON_SECRET` nativo da Vercel.
- 🧪 Gate HMG do cron deve permanecer verde no SHA final.
- 🔒 Validar Pix real ponta a ponta com credencial/conta definitiva do restaurante.
- 🔒 Validar webhook real duplicado, atrasado, inválido e webhook perdido em produção.

**Aceite:** perda de webhook não deixa pagamento permanentemente inconsistente e nenhum evento forjado confirma pagamento.

## 3. Modalidades de atendimento

- ✅ `delivery`, `pickup` e `dine_in` persistidos no pedido.
- ✅ Endereço obrigatório apenas para delivery.
- ✅ Frete, mínimo e logística aplicados apenas a delivery.
- ✅ Mesa obrigatória em `dine_in` e QR/link compatível com `?mesa=`.
- ✅ Restaurante habilita/desabilita modalidades no onboarding e em Operação.
- ✅ E2E de retirada/mesa sem cobrança de frete indevida.
- ➡️ Pedido agendado movido para P1; não faz parte do MVP comercial atual.

## 4. Tamanhos, sabores e adicionais

- ✅ Grupos de opções por produto com mínimo/máximo.
- ✅ Opções com preço, custo, disponibilidade e posição.
- ✅ Estratégias de preço `sum`, `highest`, `average` e `included`.
- ✅ Validação server-side de produto, tenant, grupo, mínimo/máximo e opções permitidas.
- ✅ Cliente não consegue adulterar preço de adicional.
- ✅ Snapshot imutável de produto, opções, preço e custo no item do pedido.
- ✅ Editor administrativo `/admin/opcoes`.
- ✅ E2E PostgreSQL para opção obrigatória, adulteração de preço e snapshot.
- ➡️ Estoque no nível do ingrediente/opção movido para P1 e só será construído se restaurantes piloto demonstrarem necessidade.

## 5. Zonas de entrega

- ✅ Zonas por CEP/bairro com taxa, mínimo e minutos adicionais.
- ✅ Cálculo da zona no servidor e snapshot da regra aplicada ao pedido.
- ✅ Rejeição server-side de endereço fora da cobertura quando a loja usa cobertura restrita.
- ✅ Tela administrativa `/admin/entrega`.
- ✅ API pública de cotação e E2E de cobertura/taxa/mínimo/snapshot.
- 🧪 Checkout público agora consulta CEP+bairro antes da confirmação, mostra zona/taxa/mínimo/prazo reais e bloqueia endereço fora da cobertura; aguarda Playwright do SHA final.
- ➡️ Polígonos/mapa e integração logística movidos para P2.

## 6. Planos e entitlements

- ✅ Regra server-side de planos Começo/Crescimento/Escala.
- ✅ Trial Começo demonstra experiência Crescimento sem liberar capacidades Scale.
- ✅ IA administrativa protegida por entitlement.
- ✅ Conexão WhatsApp protegida por entitlement.
- ✅ KDS básico protegido para Scale.
- 🧪 Webhook WhatsApp preserva histórico inbound, mas interrompe o bot pago e transfere para humano após perda de entitlement; aguarda gate final.
- ✅ Landing removeu promessa de multiunidade/fila que ainda não estava entregue.
- ➡️ Multiunidade deixou de ser P0 enquanto não fizer parte da oferta vendida; permanece no roadmap P2.

**Aceite:** frontend não é a única barreira de plano e downgrade não mantém automação paga ativa.

## 7. Cobrança da assinatura Rapidex

- ✅ Assinatura da plataforma separada do dinheiro do restaurante.
- ✅ Webhook de billing reconsulta Mercado Pago e valida referência/valor.
- ✅ Reconciliação periódica de assinaturas.
- ✅ Grace period formal de 72h.
- ✅ Política de dunning não trata cancelamento voluntário como inadimplência e não cobra antes da janela real de tolerância.
- ✅ Ledger idempotente de dunning com estágios `grace_started`, `grace_24h`, `suspended` e até 3 retries espaçados.
- ✅ Testes unitários das regras de grace/dunning.
- ✅ Cron de assinatura agendado e protegido.
- 🔒 Configurar/validar e-mail transacional definitivo em produção.
- 🔒 Validar ciclo real: pagamento inicial, renovação, recusa, grace, regularização, cancelamento, suspensão e reativação.

## 8. IA — segurança e controle econômico

- ✅ Modelo não recebe custo interno nem percentual exato de margem; recebe prioridade comercial grosseira.
- ✅ JSON Schema estrito e IDs de produto validados pelo servidor.
- ✅ Prompt trata mensagem/contexto do cliente como dados não confiáveis.
- ✅ Memória persistente rejeita conteúdo instrucional/sensível.
- ✅ Saída ao consumidor possui filtro determinístico de vazamento de `commercialPriority`, `decisionReason`, prompt/instruções internas, credenciais e termos equivalentes; suspeita força handoff humano.
- ✅ Red-team unitário cobre `ignore instructions`, system/developer prompt, token/API key, memória legítima e tentativa de vazamento na resposta.
- ✅ Limites internos diários por tenant/plano para respostas e transcrição.
- ✅ Contabilização de tokens por restaurante/dia.
- ✅ Circuit breaker por restaurante/provedor e fallback/handoff quando OpenAI falha.
- 🧪 Fluxo completo de WhatsApp + quota/circuit deve permanecer verde no SHA final.

**Aceite:** IA nunca é autoridade de preço/pagamento/reembolso e uma loja não pode gerar custo ilimitado nem derrubar IA das demais.

## 9. Segurança de aplicação e supply chain

- ✅ CSP e proteção contra frame/clickjacking.
- ✅ `Referrer-Policy`, `Permissions-Policy` e `nosniff`.
- ✅ CSRF/origin reforçado com `Sec-Fetch-Site`, Origin e Referer.
- ✅ Sessão HttpOnly, assinatura HMAC e invalidação por `auth_version`.
- ✅ PBKDF2 com salt e recuperação de senha com token hash/expiração/anti-enumeração.
- ✅ Dependency audit obrigatório no CI.
- ✅ Secret scan obrigatório no CI.
- ✅ Dependências de produção atualizadas; audit retornou zero vulnerabilidades no refresh validado.
- ✅ GitHub Actions atualizadas para v5.
- 🔒 Rotacionar/confirmar segredos definitivos de produção e aplicar menor privilégio em todas as contas externas.
- 🔒 Revisão de segurança externa antes de aquisição em escala.

## 10. Jurídico e LGPD

### Evidência técnica
- ✅ Aceite de Termos/Privacidade registra versão, usuário, restaurante e timestamp.
- ✅ Páginas legais exibem versão centralizada.
- ✅ Estrutura para solicitações de privacidade e painel administrativo.
- ✅ Fluxos técnicos de consulta/exportação/correção/opt-out implementados.
- 🧪 Retenção/anonimização destrutiva permanece condicionada à política jurídica definitiva.

### Dependências externas
- 🔒 Definir entidade contratante/CNPJ e dados societários/fiscais.
- 🔒 Revisar Termos de Uso com jurídico brasileiro.
- 🔒 Revisar Política de Privacidade.
- 🔒 Definir DPA e papéis controlador/operador por tratamento.
- 🔒 Definir política formal de retenção e base legal por classe de dado.
- 🔒 Definir canal/encarregado de privacidade e subprocessadores.
- 🔒 Avaliar transferências internacionais e procedimento jurídico de incidente.

## 11. Fotos e mídia

- ✅ JPG/PNG/WebP; SVG/HTML rejeitados.
- ✅ Validação por magic bytes e dimensões, não apenas MIME informado pelo cliente.
- ✅ Limite de tamanho diferenciado para bucket vs fallback HMG.
- ✅ Ownership de chave por tenant antes de vincular produto.
- ✅ Produção falha fechada sem object storage; Postgres base64 permanece somente como fallback de desenvolvimento/HMG.
- 🔒 Provisionar bucket/CDN definitivo e credenciais de produção.
- ⏳ Re-encode/normalização de imagem e variantes otimizadas antes de grande escala.
- ⏳ Job de limpeza de objetos órfãos após object storage definitivo.

## 12. Backup e recuperação

- 🔒 Contratar/configurar política automática de backup do Postgres e object storage.
- 🔒 Definir RPO/RTO empresarial.
- 🔒 Executar restauração real para ambiente temporário e guardar evidência.
- 🔒 Rodar migrations + E2E sobre o restore.
- ✅ Runbooks de operação/incidente documentados no repositório.

---

# P1 — necessário antes de aquisição pública em escala

## Observabilidade

- ⏳ Error tracking centralizado.
- ⏳ APM/latência p95/p99.
- ⏳ Uptime monitor externo.
- ⏳ Alertas para 5xx, pagamento/webhook, fila, WhatsApp, IA, banco, storage e e-mail.
- ⏳ Correlation/request ID e logs estruturados com política de redaction.
- ⏳ Status page quando a base justificar.

## Jobs assíncronos e resiliência

- ⏳ Fila para WhatsApp outbound, campanhas, e-mails e trabalhos pesados.
- ⏳ Retry exponencial + DLQ + idempotency key por job.
- ⏳ Dashboard de falhas e reprocessamento seguro.
- ⏳ Receber/validar/persistir webhooks rapidamente e processar trabalho pesado fora do request quando necessário.

## Onboarding e self-service

- ✅ Cadastro público, trial e onboarding guiado.
- ✅ Configuração de operação/modalidades.
- ✅ Importação de cardápio e cadastro manual.
- ✅ Publicação do cardápio sem intervenção do fundador validada no E2E público.
- ⏳ Templates por segmento para acelerar hamburgueria/pizzaria/açaí/japonês/marmitaria.
- ⏳ Importação assistida por foto/PDF/IA após validação de demanda.
- ⏳ Instrumentar métrica real “primeiro pedido em até 48h”.

## Operação/KDS

- ✅ KDS básico para plano Escala.
- ⏳ Estações (chapa/fritura/bebidas/montagem).
- ⏳ Impressão opcional.
- ✅ Alertas de novo pedido no painel.
- ⏳ SLA/atraso operacional avançado e previsão pela fila real.
- ⏳ Permissões específicas para cancelamento/reembolso.

## CRM, recompra e analytics

- ✅ Base de clientes por restaurante, histórico, consentimento, LTV e frequência básica.
- ✅ Profit Engine e atribuição de upsell/recomendação existentes.
- ✅ Guardrails de margem e aprovação humana de automação.
- ⏳ Segmentação completa: novo/recorrente/VIP/inativo/churn risk.
- ⏳ Automação de recompra com frequency cap e opt-out operacional completos.
- ⏳ Atribuição completa mensagem → conversão → margem.
- ⏳ Analytics de conversão do cardápio, abandono e recompra mais aprofundados.

## Backoffice do SaaS

- ✅ Backoffice interno básico `/admin/plataforma` com visão de tenants/saúde.
- ⏳ Saúde por integração/custo/suporte mais granular.
- ⏳ Feature flags operacionais por tenant.
- ⏳ Impersonation somente se houver necessidade real, com consentimento/motivo/prazo/auditoria.

## Performance e capacidade

- ⏳ Cache/invalidação do catálogo público por restaurante.
- ⏳ Paginação administrativa em telas que ultrapassarem limites atuais.
- ⏳ Load test formal de pico além dos testes de concorrência P0.
- ⏳ Índices revisados a partir de queries reais/telemetria.
- ⏳ Limites operacionais por tenant para outras integrações caras além de IA.

## Suporte

- ✅ Política de severidade/SLA e runbook documentados em `docs/SUPPORT_AND_INCIDENT_SLA.md`.
- 🔒 Definir canais/equipe/horários reais de suporte comercial.
- ⏳ Base de conhecimento para self-service.
- ⏳ Processo real de post-mortem e histórico de incidentes quando houver operação.

---

# P2 — tornar o ativo defensável e transferível

## Multiunidade

- ➡️ `Organization/Account` com várias lojas.
- ➡️ Membership e permissões por unidade.
- ➡️ Seletor de unidade ativa.
- ➡️ Visão consolidada de faturamento/pedidos/clientes.
- ➡️ Isolamento E2E entre organizações e lojas.

**Regra comercial atual:** não prometer/vender multiunidade até essa camada existir.

## Integrações e ecossistema

- ⏳ POS/PDV/ERP.
- ⏳ Fiscal via parceiro.
- ⏳ Logística sob demanda.
- ⏳ API pública e webhooks para parceiros.
- ⏳ Ecossistema de integrações.

## Propriedade e governança empresarial

- 🔒 Titularidade empresarial do código e cessão de PI de colaboradores.
- 🔒 Inventário/licenças open source revisados juridicamente quando necessário.
- 🔒 Registro/proteção da marca RapidexMenu.
- 🔒 Domínio, GitHub, Vercel, banco, Meta, Mercado Pago, OpenAI, e-mail, storage e DNS sob contas empresariais com MFA.
- ✅ Documentação técnica de ambiente, migrations, operação, incidentes e checklist versionada no repositório.
- ⏳ Documentação de rollback/deploy e inventário de integrações refinados até não depender do fundador.
- 🔒 Pelo menos duas pessoas autorizadas/capacitadas para operar produção.

## Métricas econômicas do ativo

- ⏳ MRR/ARR/new/expansion/contraction MRR.
- ⏳ Logo churn / revenue churn / NRR.
- ⏳ ARPA e margem bruta real.
- ⏳ CAC/payback/LTV-CAC.
- 🧪 Uso/tokens de IA por tenant já instrumentados; converter em custo financeiro real quando houver faturamento de API.
- ⏳ Custo Meta/infra/storage/suporte por tenant.
- ⏳ Dashboard de ativação D2, retenção W4 e receita recuperada/mensalidade.

---

# Gate para declarar “pronto para comercializar em escala”

- 🧪 Nenhum P0 **técnico controlável por código** aberto no SHA final.
- 🧪 CI + migrations + E2E + isolamento multi-tenant verdes no mesmo SHA final.
- 🧪 Delivery/retirada/mesa, modificadores e cotação de zona validados ponta a ponta no SHA final.
- 🔒 Pix real e cobrança recorrente validados com contas definitivas.
- 🔒 WhatsApp oficial validado com conta/número definitivo/teste aprovado.
- 🔒 E-mail transacional e object storage definitivos configurados/testados.
- 🔒 Termos/Privacidade/DPA e entidade contratante concluídos.
- 🔒 Backup restaurado com evidência.
- ⏳ Monitoramento e alertas em produção.
- ✅ Política de suporte/SLA documentada; 🔒 operação/canais reais ainda precisam ser definidos.
- ⏳ Pelo menos 3 restaurantes reais por 7 dias sem incidente grave.
- ⏳ Evidência de clientes pagantes e pelo menos uma renovação real.
- ✅ Onboarding técnico self-service validado; ⏳ medir ativação real em clientes piloto.
- ⏳ MRR, churn, ativação e retenção medidos com base real.

## Próximo gate técnico imediato

1. Fazer o **SHA final deste PR** ficar verde simultaneamente em CI, HMG E2E, Security audit e Secret scan.
2. Confirmar no HMG o novo teste de 12 pedidos concorrentes e o checkout de cotação de entrega no Playwright.
3. Depois do gate técnico, não abrir produção pública: executar os gates externos de jurídico, credenciais reais, object storage e restore de backup.
4. Rodar piloto controlado com restaurantes reais e usar telemetria para priorizar os P1, em vez de adicionar features sem evidência.
