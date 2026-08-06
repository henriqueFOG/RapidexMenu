# Primeiro teste de homologação

Este roteiro valida o produto sem depender de WhatsApp, OpenAI ou Pix reais. Use **pagamento na entrega** no primeiro pedido.

## Pré-condições

- deploy da branch principal em estado `READY`;
- `DATABASE_URL` e variáveis de acesso da HMG configuradas como segredos;
- `npm run hmg:setup` concluído sem erro;
- `GET /api/health` retornando `ok: true`, `integrations.database: true` e `integrations.databaseEngine: postgres`.

## Fluxo do cliente

1. Abra `/loja/serra-burger` no celular ou desktop.
2. Adicione um produto e abra a sacola.
3. Preencha cliente e endereço com dados fictícios identificados como teste.
4. Escolha dinheiro ou cartão na entrega e confirme.
5. Confira número do pedido, total recalculado no servidor e promessa de entrega.
6. Abra `/acompanhar/{token}` pelo link entregue no sucesso.

## Fluxo da operação

1. Abra `/admin` e entre com o código privado de HMG.
2. Confirme que o novo pedido aparece em “Recebidos”.
3. Avance por confirmado, preparo, pronto, rota e entregue.
4. Atualize o acompanhamento do cliente após cada etapa.
5. Confira métricas, cliente, valor, origem e itens no painel.

## Aceite técnico

- repetir a mesma requisição com o mesmo `clientOrderId` não cria outro pedido;
- alterar preço no navegador não muda o total calculado pelo servidor;
- um token de acompanhamento não devolve endereço completo;
- APIs administrativas sem sessão retornam `401`;
- tentativas repetidas de login e pedido são limitadas;
- tabelas, índices e dados pertencem ao restaurante correto.

## Integrações posteriores

WhatsApp Cloud API, OpenAI, Mercado Pago/Pix e uploads aparecem como pendentes até receberem credenciais oficiais. O sistema não simula conexão nem pagamento aprovado.
