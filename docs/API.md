# API do RapidexMenu

Todas as respostas JSON usam `ok`. Erros usam:

```json
{
  "ok": false,
  "error": { "code": "validation_error", "message": "Mensagem segura" }
}
```

## Públicas

### `GET /api/public/menu/:slug`

Retorna restaurante, categorias e produtos disponíveis. Não retorna custo ou margem.

### `POST /api/public/orders`

Cria pedido com preços recalculados no servidor.

```json
{
  "restaurantSlug": "serra-burger",
  "clientOrderId": "uuid-do-navegador",
  "source": "menu",
  "customer": {
    "name": "Ana Lima",
    "phone": "5524999999999",
    "email": "ana@example.com",
    "whatsappConsent": true,
    "address": {
      "street": "Rua Exemplo",
      "number": "10",
      "neighborhood": "Centro",
      "city": "Petrópolis",
      "state": "RJ",
      "postalCode": "25600000"
    }
  },
  "items": [{ "productId": "prod_combo", "quantity": 1 }],
  "paymentMethod": "pix"
}
```

Repetir o mesmo `clientOrderId` retorna o pedido existente.

### `GET /api/public/orders/:trackingToken`

Retorna estado, itens, total, promessa e Pix associado. O token é aleatório e não sequencial.

### `POST /api/public/leads`

Registra interesse do Programa Fundadores com rate limit.

### `GET /api/public/media/*`

Entrega somente objetos no prefixo `public/` do R2.

## Gestão autenticada

| Método e rota | Papel mínimo | Uso |
|---|---|---|
| `GET /api/admin/overview` | membro | métricas, fila, ROI e integrações |
| `GET /api/admin/orders` | membro | lista de pedidos |
| `PATCH /api/admin/orders/:id` | operação | avança estado válido |
| `GET /api/admin/products` | membro | cardápio e margem |
| `POST /api/admin/products` | gerente | cria produto |
| `PATCH /api/admin/products/:id` | gerente | altera produto/estoque |
| `DELETE /api/admin/products/:id` | gerente | arquiva produto |
| `GET /api/admin/customers` | membro | CRM |
| `GET /api/admin/automations` | membro | oportunidades |
| `PATCH /api/admin/automations/:id` | gerente | aprova/descarta |
| `GET/PATCH /api/admin/settings` | gerente para escrita | configura loja |
| `POST /api/admin/uploads` | gerente | imagem JPG/PNG/WebP até 5 MB |
| `POST /api/admin/ai/reply` | membro | simula vendedor com contexto real |

Mutações administrativas validam origem e associação do usuário ao restaurante.

## Webhooks

### `GET/POST /api/webhooks/whatsapp`

- GET: handshake `hub.challenge`;
- POST: HMAC `X-Hub-Signature-256` sobre corpo bruto;
- deduplicação por mensagem;
- texto/áudio, memória e transferência humana;
- status de mensagens recebido no mesmo campo.

### `POST /api/webhooks/mercado-pago`

- valida `x-signature` e `x-request-id`;
- deduplica evento;
- consulta Order API;
- atualiza pagamento e confirma pedido somente após resposta do provedor.

## Saúde

`GET /api/health` verifica D1 e expõe apenas booleanos de prontidão, sem segredo.
