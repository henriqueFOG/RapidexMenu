# Ambiente e integrações

Variáveis abaixo são nomes de configuração. Nunca coloque valores reais em arquivo versionado ou no chat.

## Base da HMG (Vercel)

| Variável/binding | Uso |
|---|---|
| `DATABASE_URL` | conexão privada do PostgreSQL/Neon; nunca é enviada ao navegador |
| `RAPIDEX_ENV` | usar `homologation` na HMG |
| `RAPIDEX_AUTH_MODE` | usar `hmg-access-code` na HMG |
| `RAPIDEX_HMG_OWNER_EMAIL` | e-mail que assume a loja de teste |
| `RAPIDEX_HMG_OWNER_NAME` | nome exibido no painel |
| `RAPIDEX_HMG_ACCESS_CODE` | código privado com pelo menos 16 caracteres; armazenar como segredo |
| `RAPIDEX_PUBLIC_URL` | URL canônica, quando necessária para callback |

O adaptador aceita `POSTGRES_URL` como compatibilidade, mas `DATABASE_URL` é o nome canônico. O schema é aplicado com `npm run db:postgres:migrate` e os dados controlados de HMG com `npm run db:postgres:seed`. Upload de imagens não faz parte do primeiro teste na Vercel; os produtos iniciais usam ilustrações embutidas e o status permanece pendente até a escolha de um armazenamento de objetos.

## Compatibilidade Sites/Cloudflare

| Binding | Uso |
|---|---|
| `DB` | Cloudflare D1, quando a aplicação roda no Sites |
| `BUCKET` | Cloudflare R2 para fotos públicas |
| `RAPIDEX_OWNER_EMAIL` | proprietário no fluxo Sign in with ChatGPT |

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

Assinar o campo `messages`. Para múltiplos restaurantes, cadastrar `external_phone_id` na tabela `integrations` e manter credenciais no cofre da hospedagem, nunca no PostgreSQL/D1 sem criptografia e gestão de chaves.

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
