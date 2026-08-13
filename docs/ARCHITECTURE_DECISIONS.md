# RapidexMenu — decisões e invariantes de arquitetura comercial

Este documento registra decisões que não devem ser alteradas silenciosamente porque protegem receita, isolamento multiempresa, histórico financeiro ou a capacidade de operar o SaaS como ativo transferível.

## 1. Fonte de verdade do banco comercial

O ambiente comercial usa PostgreSQL/Neon. As migrations em `db/postgres/*.sql` são a fonte de verdade para a estrutura comercial de produção/HMG e devem ser aplicadas em ordem pelo `scripts/migrate-postgres.mjs`.

`db/schema.ts` contém um modelo legado/compatível com D1/SQLite e **não deve ser usado para gerar migrations de produção** enquanto não for deliberadamente reconciliado com PostgreSQL. Uma futura consolidação deve gerar o schema tipado a partir do contrato PostgreSQL ou remover a duplicidade.

## 2. Multi-tenant

- Dados operacionais pertencem sempre a um `restaurant_id`.
- APIs administrativas derivam o tenant da sessão; nunca confiam em `restaurantId` vindo do navegador.
- Updates/deletes devem incluir tenant no `WHERE` sempre que a entidade for tenant-scoped.
- Invariantes críticas podem existir no banco além da API. Exemplo: `order_items` bloqueia produto de outro restaurante e reserva estoque sob lock.
- Novas tabelas multiempresa devem ter índices iniciados por `restaurant_id` nas queries operacionais de maior frequência.

## 3. Dinheiro e histórico imutável

- O navegador nunca define preço final.
- Preços/custos são recalculados no servidor.
- `order_items` guardam snapshot de nome, preço e custo do produto.
- `order_item_options` guardam snapshot das escolhas e do valor efetivamente cobrado.
- Pedidos de entrega guardam snapshot da zona aplicada.
- Alterar cardápio, adicional ou zona depois da venda não pode alterar pedido histórico.

## 4. Concorrência

- Estoque controlado é reservado dentro da transação de criação de pedido com lock no produto.
- Uma corrida pela última unidade deve produzir um vencedor e conflito comercial `409` para a outra transação.
- Status de pedido usa compare-and-set; atualização concorrente não pode sobrescrever silenciosamente a decisão de outro operador.
- `clientOrderId` permanece a chave de idempotência do checkout.

## 5. Modalidades de atendimento

- `delivery`, `pickup` e `dine_in` são regras de negócio de primeira classe.
- Só `delivery` exige endereço, frete, cobertura, pedido mínimo logístico e tempo de entrega.
- `pickup` e `dine_in` não herdam frete por acidente.
- `dine_in` exige identificação de mesa/comanda enquanto esse fluxo estiver ativo.
- Lojas existentes permanecem delivery-only até opt-in, evitando mudança operacional silenciosa.

## 6. Opções e modificadores

Grupos de opções suportam:

- mínimo/máximo de escolhas;
- estratégia `sum`, `highest`, `average` ou `included`;
- preço e custo adicionais;
- disponibilidade.

A validação final ocorre no servidor. IDs de opção enviados pelo cliente são dados não confiáveis.

## 7. Cobertura de entrega

- Zonas podem usar prefixo de CEP ou bairro normalizado.
- CEP tem prioridade sobre bairro; prefixo mais específico vence prefixo genérico.
- A loja pode usar zonas apenas como override ou restringir atendimento às zonas cadastradas.
- Cotação pública e checkout usam a mesma regra server-side.

## 8. Pagamentos

- Dinheiro da assinatura Rapidex e dinheiro de pedidos do restaurante usam credenciais/fluxos distintos.
- Webhook nunca é autoridade isolada: o provedor é reconsultado.
- Pagamentos pendentes possuem caminho de reconciliação independente do webhook.
- Rotinas agendadas exigem segredo e não retornam PII/credenciais.

## 9. IA

- IA interpreta intenção, não controla preço, disponibilidade, desconto, pagamento ou autorização.
- Contexto de usuário é dado não confiável.
- Custos/margens exatas não são enviados ao modelo quando uma prioridade abstrata é suficiente.
- Saída estruturada é saneada pelo servidor.
- Reclamação, alergia, reembolso e situações ambíguas devem escalar para humano conforme guardrails.

## 10. Planos e entitlements

- Feature paga é bloqueada no servidor, não apenas escondida no frontend.
- Trial pode demonstrar nível superior conforme estratégia comercial documentada.
- Downgrade nunca deve impedir o cliente de desconectar integração ou acessar dados necessários para encerramento/portabilidade.

## 11. Migrations

- Migration aplicada nunca é editada retroativamente em produção.
- Alteração nova recebe novo número.
- Migration estrutural relevante passa por Postgres isolado + E2E antes de HMG público/produção.
- Mudança destrutiva exige snapshot/backup validado conforme runbook.

## 12. Critério de conclusão

Código escrito não equivale a item concluído. Um item só vira `✅` no checklist de prontidão quando o gate correspondente (unitário, build, Postgres E2E, HMG real ou validação externa) foi executado com evidência adequada.
