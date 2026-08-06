# Ambiente e integrações

Variáveis abaixo são nomes de configuração. Nunca coloque valores reais em arquivo versionado ou no chat.

## Base

| Variável/binding | Uso |
|---|---|
| `DB` | binding Cloudflare D1 |
| `BUCKET` | binding Cloudflare R2 para fotos públicas |
| `RAPIDEX_OWNER_EMAIL` | e-mail autorizado a reivindicar a primeira loja |
| `RAPIDEX_PUBLIC_URL` | URL canônica, quando necessária para callback |

## OpenAI

| Variável | Uso |
|---|---|
| `OPENAI_API_KEY` | chave server-side |
| `OPENAI_MODEL` | modelo de resposta estruturada; padrão no código: `gpt-5-mini` |
| `OPENAI_TRANSCRIBE_MODEL` | transcrição; padrão: `gpt-4o-mini-transcribe` |

Integração usa Responses API com `text.format` em JSON Schema e Audio Transcriptions por multipart. Referências oficiais: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) e [File transcription](https://developers.openai.com/api/docs/guides/speech-to-text).

## WhatsApp Cloud API

| Variável | Uso |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | token de sistema server-side |
| `WHATSAPP_PHONE_NUMBER_ID` | identificador do número |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA ID |
| `WHATSAPP_VERIFY_TOKEN` | segredo escolhido para handshake GET |
| `WHATSAPP_APP_SECRET` | valida `X-Hub-Signature-256` |
| `WHATSAPP_GRAPH_VERSION` | versão da Graph API; configurável sem alterar código |

Callback:

```text
https://SEU_DOMINIO/api/webhooks/whatsapp
```

Assinar o campo `messages`. Para múltiplos restaurantes, cadastrar `external_phone_id` na tabela `integrations` e manter credenciais em cofre/secret store referenciado, nunca em D1 sem criptografia e gestão de chaves.

## Mercado Pago / Pix

| Variável | Uso |
|---|---|
| `MERCADO_PAGO_ACCESS_TOKEN` | Access Token privado, server-side |
| `MERCADO_PAGO_WEBHOOK_SECRET` | valida `x-signature` |

Callback:

```text
https://SEU_DOMINIO/api/webhooks/mercado-pago
```

Configurar evento **Order (Mercado Pago)**. A integração usa Orders API, `X-Idempotency-Key`, Pix e consulta `/v1/orders/{id}` após a notificação. Referências oficiais: [Pix via Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix) e [notificações](https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/notifications).

## Estado sem credencial

O aplicativo continua funcional para:

- site, cardápio, pedidos e acompanhamento;
- pagamento na entrega;
- painel, CRM, margem e fila;
- demonstração determinística do vendedor.

Integrações não configuradas aparecem como pendentes. O sistema não gera QR Code falso, não envia mensagem simulando sucesso e não marca pagamento como aprovado.
