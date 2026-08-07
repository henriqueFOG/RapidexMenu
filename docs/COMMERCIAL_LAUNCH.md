# RapidexMenu — checklist de lançamento comercial

Este documento separa o que já está implementado no produto do que depende de credenciais/contas externas antes de abrir o cadastro para restaurantes pagantes.

## Fluxo comercial implementado

1. Restaurante acessa `/cadastro`.
2. Cria usuário com e-mail e senha e aceita Termos/Privacidade.
3. A plataforma cria a loja, vínculo de proprietário e trial de 14 dias.
4. O proprietário passa pelo `/onboarding`.
5. Configura cidade/UF, WhatsApp, taxa, pedido mínimo e tempos.
6. Cria categoria e primeiro produto.
7. Publica a loja e recebe seu link `/loja/<slug>`.
8. Pode seguir testando ou ativar assinatura em `/assinatura`.
9. Cliente final consulta cardápio, cria pedido e recebe token de acompanhamento.
10. Restaurante recebe pedido no painel e avança os estados.
11. Trial expirado sem assinatura ativa deixa de aceitar novos pedidos.
12. Senha pode ser recuperada por token único e expirável enviado por e-mail.

## Variáveis obrigatórias para produção comercial

```text
DATABASE_URL=<PostgreSQL/Neon>
RAPIDEX_ENV=production
RAPIDEX_PUBLIC_URL=https://rapidexmenu.com.br
RAPIDEX_AUTH_MODE=native
RAPIDEX_SESSION_SECRET=<segredo aleatorio forte com 32+ caracteres>
RAPIDEX_SIGNUP_ENABLED=true
```

Nunca versionar os valores reais no GitHub.

## Cobrança da mensalidade Rapidex

A cobrança da plataforma usa uma credencial separada da credencial de pagamentos dos pedidos dos restaurantes:

```text
RAPIDEX_BILLING_MP_ACCESS_TOKEN=<credencial da conta Mercado Pago da Rapidex>
```

Configurar no Mercado Pago uma notificação para:

```text
https://rapidexmenu.com.br/api/webhooks/rapidex-billing
```

A aplicação reconsulta a assinatura diretamente no provedor antes de ativar a loja e confere o restaurante e o valor do plano.

## Recuperação de senha / e-mail transacional

```text
RESEND_API_KEY=<credencial do provedor de e-mail>
RAPIDEX_EMAIL_FROM=<remetente de domínio verificado>
```

O domínio/remetente deve estar verificado antes de liberar clientes pagantes.

## Integrações do restaurante

Estas integrações não devem ser confundidas com a cobrança da mensalidade Rapidex:

```text
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_GRAPH_VERSION=
OPENAI_API_KEY=
```

Até as credenciais oficiais existirem, não exibir sucesso falso de Pix, WhatsApp ou IA. Pagamento na entrega continua sendo o caminho seguro para piloto.

## Antes de abrir aquisição paga

- validar build e migrations no Vercel;
- executar cadastro -> onboarding -> publicação -> pedido -> recebimento -> entrega em produção controlada;
- validar isolamento entre pelo menos duas lojas;
- confirmar e-mail de recuperação;
- confirmar assinatura sandbox/conta de teste e webhook;
- publicar identidade jurídica real, CNPJ e contato de suporte nos documentos legais;
- configurar monitoramento/alertas de erros;
- rotacionar/remover qualquer segredo histórico que tenha sido versionado em repositórios antigos;
- manter backup/recuperação do PostgreSQL compatível com o plano contratado.

## Critério para dizer “pronto para comercializar”

O código estar em produção não é suficiente. O sinal verde comercial exige, no mínimo:

- autenticação nativa ativa;
- PostgreSQL operacional e migrado;
- cadastro e onboarding ponta a ponta aprovados;
- cardápio/pedido/acompanhamento aprovados;
- cobrança Rapidex ou processo comercial alternativo definido;
- recuperação de acesso funcional;
- documentos legais com dados reais da empresa;
- suporte/contato real publicado;
- integração principal prometida na oferta disponível ou claramente marcada como beta/piloto.
