# RapidexMenu

SaaS multiempresa para restaurantes venderem no canal próprio, receberem pedidos sem atrito e aumentarem recompra com controle de margem.

O produto reúne:

- landing page comercial;
- cardápio público e checkout responsivo;
- criação idempotente de pedidos e acompanhamento por token;
- painel protegido por Sign in with ChatGPT;
- CRM, cardápio, fila de pedidos, automações e auditoria;
- banco Cloudflare D1 e imagens em R2;
- adaptadores para WhatsApp Cloud API, OpenAI e Pix via Mercado Pago;
- webhooks assinados e deduplicados;
- demonstração Serra Burger com dados iniciais reais no banco.

## Diferencial

O RapidexMenu não compete apenas como “robô de WhatsApp”. O núcleo é:

1. **Vendedor com memória:** transforma “o de sempre” em recompra contextual.
2. **Guardião de margem:** usa custo, disponibilidade e capacidade antes de recomendar.
3. **Promessa segura:** o prazo acompanha a carga ativa da cozinha.
4. **ROI visível:** separa receita recuperada e recompra da venda comum.
5. **Ativo próprio:** cardápio, relacionamento e histórico pertencem ao restaurante, sem comissão Rapidex por pedido.

## Rotas principais

- `/` — site comercial e demonstração;
- `/loja/serra-burger` — cardápio operacional;
- `/admin` — gestão protegida;
- `/acompanhar/:token` — acompanhamento do cliente;
- `/api/health` — saúde e prontidão das integrações.

## Desenvolvimento

Requisitos: Node.js `>=22.13.0`.

```bash
npm run dev
npm run lint
npm run build
```

As migrações Drizzle ficam em `drizzle/` e são geradas com:

```bash
npm run db:generate
```

Não grave segredos no repositório. Consulte [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Documentação

- [Produto e modelo de negócio](docs/PRODUCT_AND_BUSINESS.md)
- [Plano comercial de 90 dias](docs/GTM_90_DAYS.md)
- [Segurança e privacidade](docs/SECURITY_PRIVACY.md)
- [Referência das APIs](docs/API.md)
- [Ambiente e integrações](docs/ENVIRONMENT.md)
- [Checklist de lançamento](docs/LAUNCH_CHECKLIST.md)
