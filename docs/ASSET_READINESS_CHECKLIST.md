# RapidexMenu — checklist vivo de prontidão como ativo comercial

Atualizado em: 13/08/2026  
Branch de execução: `agent/commercial-hardening-p0`  
PR de trabalho: #8 → `hmg`

## Legenda

- ✅ **Implementado e validado**: código presente e gate automático correspondente aprovado.
- 🧪 **Implementado, em validação**: código presente; ainda falta E2E/HMG ou teste específico antes de considerar concluído.
- ⏳ **Pendente técnico**: precisa ser implementado no produto/infra.
- 🔒 **Dependência externa**: exige jurídico, conta/credencial, fornecedor, decisão societária ou validação humana externa ao código.

> Regra: nenhum item externo é marcado como concluído só porque existe estrutura de código para suportá-lo.

---

# P0 — antes de cobrar/abrir clientes pagantes

## Integridade de pedidos e estoque

- 🧪 Guard transacional PostgreSQL contra overselling concorrente (`0011_order_item_stock_guard.sql`).
- 🧪 Invariante de banco impedindo `order_item` de produto pertencente a outro tenant.
- 🧪 Resposta comercial `409 insufficient_stock` para corrida de estoque.
- 🧪 Teste E2E com duas compras concorrentes da última unidade.
- 🧪 Transição de status com compare-and-set e `409 order_state_conflict`.
- 🧪 Teste E2E com dois operadores disputando alteração do mesmo pedido.
- ✅ Preço base é recalculado no servidor e não confia no navegador.
- ✅ Idempotência de checkout por `clientOrderId` já existia e permanece coberta.
- ⏳ Reconciliação periódica de pagamentos pendentes/perda de webhook.
- ⏳ Teste dedicado de numeração de pedidos sob alta concorrência.

## Cardápio universal — modalidades

- 🧪 Modelo de pedido `delivery | pickup | dine_in` (`0013_order_fulfillment.sql`).
- 🧪 Endereço obrigatório somente em `delivery`.
- 🧪 Frete, pedido mínimo e tempo logístico aplicados somente em `delivery`.
- 🧪 Mesa obrigatória em `dine_in`.
- 🧪 Configuração por restaurante das modalidades habilitadas.
- 🧪 Loja pública exibe seletor Entrega / Retirada / Consumir no local.
- 🧪 QR/link por mesa via `?mesa=<codigo>` respeitando configuração da loja.
- 🧪 Onboarding permite escolher modalidades.
- 🧪 Painel pós-publicação permite alterar modalidades em Horários/Operação.
- ✅ Compatibilidade: lojas já existentes permanecem delivery-only até opt-in.
- 🧪 Novas lojas têm frete e pedido mínimo neutros (`0`) até o proprietário configurar; lojas existentes não são alteradas (`0016_safe_new_store_defaults.sql`).
- ⏳ Pedido agendado: coluna preparada, fluxo de negócio/UI ainda não implementado.

## Cardápio universal — tamanhos, sabores e adicionais

- 🧪 `product_option_groups` com mínimo/máximo de escolhas.
- 🧪 `product_options` com acréscimo de preço/custo e disponibilidade.
- 🧪 Estratégias de cobrança: `sum`, `highest`, `average`, `included`.
- 🧪 Servidor valida que opção pertence ao produto e ao tenant.
- 🧪 Servidor valida min/max; navegador não é autoridade.
- 🧪 Servidor calcula preço e custo dos modificadores.
- 🧪 Snapshot imutável em `order_item_options`, incluindo valor efetivamente cobrado.
- 🧪 Loja pública possui configurador de produto.
- 🧪 Carrinho suporta o mesmo produto com configurações diferentes.
- 🧪 Tracking expõe snapshot de opções sem depender do cardápio atual.
- 🧪 Editor no-code em `/admin/opcoes` para tamanhos/sabores/adicionais.
- ⏳ Teste E2E específico de preço adulterado em modificadores e escolha obrigatória.
- ⏳ Estoque individual de opções/ingredientes, caso validado como necessário comercialmente.

## Entrega e cobertura

- ⏳ Zonas de entrega por CEP/bairro/faixa ou polígono.
- ⏳ Frete por zona calculado no servidor.
- ⏳ Pedido mínimo por zona.
- ⏳ Prazo adicional por zona.
- ⏳ Bloqueio de endereço fora da cobertura.
- ⏳ Interface administrativa para cobertura de entrega.
- ⏳ Integração logística/parceiro: somente após validação do núcleo.

## Planos e monetização SaaS

- 🧪 Entitlements server-side criados para IA, WhatsApp, multiunidade e KDS.
- ✅ Testes unitários de entitlements passaram no CI.
- 🧪 IA comercial bloqueada no servidor abaixo de Growth fora do trial.
- 🧪 Conexão do WhatsApp bloqueada no servidor abaixo de Growth fora do trial.
- 🧪 Regra comercial: trial Start demonstra recursos Growth; Scale continua exclusivo.
- ⏳ Aplicar entitlements a todos os recursos pagos restantes, não apenas IA/WhatsApp.
- ⏳ Desativar automação do WhatsApp de forma segura após downgrade, sem impedir desconexão/status transacional.
- ⏳ Limites/franquias de IA e mensageria por plano.
- ⏳ Grace period formal para inadimplência.
- ⏳ Dunning (avisos, retry, suspensão e reativação).
- ⏳ Reconciliação periódica de assinatura Rapidex com Mercado Pago.
- 🔒 Validar assinatura real/renovação/recusa/cancelamento com conta comercial definitiva.

## Multiunidade

- ⏳ Criar `Organization/Account` acima das lojas.
- ⏳ Um usuário pertencer a múltiplas lojas sem criar outra conta.
- ⏳ Seletor de unidade ativa.
- ⏳ Permissões por unidade.
- ⏳ Visão consolidada de unidades.
- ⏳ E2E de isolamento entre organizações e unidades.
- ⏳ Fazer a promessa comercial “até 3 unidades” depender desta implementação real.

## Segurança

- ✅ CI principal: TypeScript, unit tests e production build aprovados no primeiro lote do PR.
- 🧪 CSP global adicionada; precisa ser validada no HMG com Meta/Mercado Pago reais.
- 🧪 `frame-ancestors`, X-Frame-Options, Referrer-Policy, Permissions-Policy e `nosniff` adicionados.
- 🧪 CSRF/origin reforçado com `Sec-Fetch-Site`, Origin e Referer.
- ✅ Sessão HttpOnly, assinatura e autenticação nativa já existiam.
- ✅ Teste adversarial multi-tenant já existia e permanece obrigatório.
- ⏳ Dependency scanning automatizado.
- ⏳ Secret scanning/gate de segredo no CI.
- 🔒 Rotacionar/remover qualquer segredo histórico de repositórios/ambientes antigos.
- 🔒 Revisão de segurança externa antes de aquisição em escala.

## IA e automação

- ✅ Saída estruturada/JSON Schema e IDs validados no servidor já existiam.
- 🧪 Percentual exato de margem deixou de ser enviado ao modelo; IA recebe prioridade comercial abstrata.
- 🧪 Prompt proíbe revelar custo, margem, regra interna, prompt, IDs, credenciais e `decisionReason`.
- 🧪 Contexto/mensagem são explicitamente tratados como dados não confiáveis.
- 🧪 Memória persistente filtra conteúdo instrucional/sensível.
- ✅ Preço, disponibilidade e fechamento permanecem sob autoridade do servidor.
- ⏳ Suite automatizada de prompt-injection/red-team.
- ⏳ Limite de gasto/uso de IA por tenant e plano.
- ⏳ Circuit breaker/fallback operacional mensurável.

## Jurídico / LGPD

- 🧪 Versão dos Termos e Privacidade centralizada no código.
- 🧪 Aceites versionados persistidos por usuário/restaurante (`legal_acceptances`).
- 🧪 Signup retorna/registre a versão legal aceita.
- 🔒 Revisão dos Termos por jurídico brasileiro.
- 🔒 Revisão da Política de Privacidade por jurídico brasileiro.
- 🔒 DPA e definição controlador/operador por fluxo.
- 🔒 Definir entidade contratante/CNPJ/conta empresarial.
- ⏳ Processo técnico para exportação/correção/exclusão/anonimização de titular.
- ⏳ Painel/processo de opt-out e solicitações LGPD.
- ⏳ Política/rotina automática de retenção por categoria de dado.
- 🔒 Revisar subprocessadores e transferência internacional.
- 🔒 Canal/contato real de privacidade/encarregado.

## Mídia

- ✅ Upload já limita JPG/PNG/WebP e impede SVG/HTML no fluxo existente.
- ⏳ Validação por magic bytes (não confiar apenas em MIME do cliente).
- ⏳ Decodificação/re-encode seguro e limite de dimensões.
- ⏳ Object storage definitivo (R2/Vercel Blob/S3 ou equivalente).
- ⏳ Banco guardar somente chave/metadados, não binário em escala.
- ⏳ Limpeza de objetos órfãos.
- 🔒 Provisionar storage definitivo e credenciais de produção.

## Backup / recuperação

- ✅ Runbook de piloto e snapshot HMG já documentados no repositório.
- 🔒 Confirmar política de backup do PostgreSQL contratado em produção.
- 🔒 Executar restauração real em cópia isolada e registrar evidência.
- ⏳ Automatizar verificação periódica de restauração quando a infraestrutura permitir.
- ⏳ Definir RPO/RTO formal.

---

# P1 — antes de abrir aquisição pública em escala

## Filas, webhooks e resiliência

- ⏳ Fila assíncrona para webhooks, WhatsApp, e-mail e jobs pesados.
- ⏳ Retry exponencial e idempotente.
- ⏳ Dead-letter queue.
- ⏳ Dashboard/reprocessamento seguro de jobs falhos.
- ⏳ Webhook responder rápido após validar/persistir; processamento pesado assíncrono.

## Observabilidade

- ⏳ Error tracking/APM.
- ⏳ Uptime externo.
- ⏳ Alertas de 5xx, latência, pagamento pendente, webhook falho e fila atrasada.
- ⏳ Correlation/request ID em logs.
- ⏳ Logs estruturados com redaction de PII/segredos.
- 🔒 Definir ferramenta/conta de observabilidade de produção.

## Onboarding e ativação

- ✅ Onboarding, importação e publicação já existiam.
- 🧪 Onboarding agora inclui modalidades de atendimento.
- ⏳ Templates de configuração por segmento (pizza, açaí, hamburgueria, japonês, marmita).
- ⏳ Importação de opções/modificadores junto do cardápio.
- ⏳ Checklist visual de ativação completo e time-to-value medido.
- ⏳ Instrumentar “primeiro pedido em até 48h”.

## Operação / KDS

- ⏳ KDS por estação.
- ⏳ Impressão opcional.
- ⏳ Pausa/capacidade automática por fila.
- ⏳ Sinalização de atraso e SLA operacional.
- ⏳ Cancelamento/reembolso com motivo e permissão.
- ⏳ Histórico de quem fez cada alteração sensível.

## CRM / recompra

- ✅ Base de clientes, preferências e histórico já existem parcialmente.
- ⏳ Segmentação operacional (novo, recorrente, VIP, inativo, risco de churn).
- ⏳ Automação de recompra com consentimento, frequency cap e opt-out.
- ⏳ Atribuição completa mensagem → pedido → receita → margem.
- ⏳ LTV/frequência/coortes por cliente.

## Backoffice da própria Rapidex

- ⏳ Console interno de tenants/planos/trials/integrações/saúde/consumo.
- ⏳ Feature flags por tenant.
- ⏳ Suspensão/reativação com auditoria.
- ⏳ Impersonation somente se necessária, com consentimento, motivo e auditoria.

## Performance / escala

- ⏳ Cache do cardápio público com invalidação por restaurante.
- ⏳ Separar catálogo quase-estático de disponibilidade dinâmica.
- ⏳ Paginação dos painéis administrativos.
- ⏳ Índices orientados por queries e telemetria real.
- ⏳ Load test de pedidos/webhooks/WhatsApp.
- ⏳ PWA operacional/instalável e experiência de tablet/KDS.

---

# P2 — tornar o ativo defensável e transferível

## Integrações

- ⏳ POS/PDV/ERP.
- ⏳ Fiscal via parceiro.
- ⏳ Logística sob demanda.
- ⏳ API pública e webhooks para parceiros.
- ⏳ Ecossistema de integrações.

## Propriedade e governança empresarial

- 🔒 Titularidade empresarial do código e cessão de PI de colaboradores.
- 🔒 Inventário/licenças open source revisados juridicamente quando necessário.
- 🔒 Registro/proteção da marca RapidexMenu.
- 🔒 Domínio, GitHub, Vercel, banco, Meta, Mercado Pago, OpenAI e DNS sob contas empresariais com MFA.
- ⏳ Documentação de deploy, rollback, banco e integrações independente do fundador.
- 🔒 Pelo menos duas pessoas autorizadas/capacitadas para operar produção.

## Métricas econômicas do ativo

- ⏳ MRR/ARR/new/expansion/contraction MRR.
- ⏳ Logo churn / revenue churn / NRR.
- ⏳ ARPA e margem bruta real.
- ⏳ CAC/payback/LTV-CAC.
- ⏳ Custo OpenAI/Meta/infra/suporte por tenant.
- ⏳ Dashboard de ativação D2, retenção W4 e receita recuperada/mensalidade.

---

# Gate para declarar “pronto para comercializar em escala”

- ⏳ Nenhum P0 técnico aberto.
- ⏳ CI + migrations + E2E + isolamento multi-tenant verdes no SHA publicado.
- ⏳ Delivery/retirada e modificadores validados ponta a ponta.
- 🔒 Pix real e cobrança recorrente validados com contas definitivas.
- 🔒 WhatsApp oficial validado com conta/número definitivo/teste aprovado.
- 🔒 Termos/Privacidade/DPA e entidade contratante concluídos.
- 🔒 Backup restaurado com evidência.
- ⏳ Monitoramento e alertas em produção.
- ⏳ Suporte/SLA real definidos.
- ⏳ Pelo menos 3 restaurantes reais por 7 dias sem incidente grave.
- ⏳ Evidência de clientes dispostos a pagar/renovar.
- ⏳ Onboarding não depender tecnicamente do fundador.
- ⏳ MRR, churn, ativação e uso medidos.

## Próximo gate técnico imediato

1. Fazer o HMG E2E passar com PostgreSQL real após migrations 0011–0016.
2. Adicionar E2E para modalidades e modificadores/preço server-side.
3. Implementar zonas de entrega e cobertura.
4. Hardening de mídia/object storage.
5. Reconciliação financeira e disciplina de billing.
