# RapidexMenu — checklist de lançamento comercial

Este documento separa o que já está implementado no produto do que depende de credenciais/contas externas antes de abrir o cadastro para restaurantes pagantes.

## Fluxo comercial implementado

1. Restaurante acessa `/cadastro`.
2. Cria usuário com e-mail e senha e aceita Termos/Privacidade.
3. A plataforma cria a loja, vínculo de proprietário e trial de 14 dias.
4. O proprietário passa pelo `/onboarding`.
5. Configura cidade/UF, WhatsApp, taxa, pedido mínimo e tempos.
6. Importa até 250 produtos por CSV/TXT ou cria itens manualmente; custo é obrigatório para o Profit Engine.
7. Configura agenda semanal/pausa emergencial em `/admin/horarios`.
8. Publica a loja e recebe seu link `/loja/<slug>`.
9. Cliente final consulta cardápio, recebe recomendações de margem, cria pedido e recebe token de acompanhamento.
10. Restaurante recebe o pedido no painel e avança os estados; alertas de navegador são opt-in.
11. Trial expirado sem assinatura ativa deixa de aceitar novos pedidos em qualquer canal.
12. Senha pode ser recuperada por token único e expirável enviado por e-mail.
13. A loja pode conectar sua conta Mercado Pago por OAuth em `/admin/pagamentos` para habilitar Pix próprio.
14. A loja pode conectar seu WhatsApp pelo Embedded Signup oficial da Meta em `/admin/whatsapp` quando a plataforma Meta estiver configurada.

## Profit Engine

- custo e margem são calculados no servidor;
- upsell combina margem, afinidade histórica e pressão da cozinha;
- `upsell_shown` e `upsell_accepted` são registrados separadamente;
- `/admin/lucro` mostra contribuição, receita atribuída, conversão, recompra, precisão da promessa e ROI;
- recomendações não são exibidas fora do horário de funcionamento;
- `/calculadora` usa premissas editáveis e declara explicitamente que é uma simulação.

## WhatsApp ponta a ponta

O fluxo comercial do WhatsApp foi desenhado para não confiar no modelo de IA para preço ou conclusão de compra:

1. `phone_number_id` roteia a mensagem para o `restaurant_id` correto;
2. texto e áudio usam a credencial criptografada da própria loja;
3. a IA interpreta carrinho/endereço/pagamento em JSON estruturado;
4. IDs inexistentes/indisponíveis são filtrados no servidor;
5. um rascunho persistente mantém carrinho, endereço e forma de pagamento;
6. dinheiro/cartão na entrega são os métodos permitidos no fechamento automatizado inicial;
7. só uma confirmação explícita (`CONFIRMAR`, `SIM`, etc.) libera a tentativa de pedido;
8. `createOrder()` recalcula preço/custo, valida estoque, mínimo, horário e assinatura;
9. o restaurante recebe o pedido no mesmo painel;
10. mudanças de status originadas no WhatsApp geram mensagens transacionais sem impedir a operação caso a Meta falhe;
11. `acompanhar meu pedido` consulta o banco da própria loja/cliente;
12. `pedir de novo` reutiliza IDs/quantidades do último pedido real e exige nova confirmação.

### Embedded Signup da Meta

A conexão multiempresa não aceita `phone_number_id` digitado manualmente. O fluxo oficial:

- Facebook Login for Business / WhatsApp Embedded Signup;
- recebe código temporário + WABA + Phone Number ID;
- backend troca o código usando App Secret server-side;
- backend consulta o WABA para provar que o número pertence à autorização;
- backend assina o WABA em `subscribed_apps`;
- backend registra o telefone para Cloud API com PIN aleatório de 6 dígitos;
- token e PIN são criptografados com `RAPIDEX_INTEGRATION_SECRET`;
- a tabela `integrations` guarda somente roteamento/metadados sem segredo.

## Variáveis obrigatórias para produção comercial

```text
DATABASE_URL=<PostgreSQL/Neon>
RAPIDEX_ENV=production
RAPIDEX_PUBLIC_URL=https://rapidexmenu.com.br
RAPIDEX_AUTH_MODE=native
RAPIDEX_SESSION_SECRET=<segredo aleatorio forte com 32+ caracteres>
RAPIDEX_INTEGRATION_SECRET=<segredo aleatorio forte com 32+ caracteres>
RAPIDEX_SIGNUP_ENABLED=true
```

Nunca versionar os valores reais no GitHub.

## Cobrança da mensalidade Rapidex

```text
RAPIDEX_BILLING_MP_ACCESS_TOKEN=<credencial da conta Mercado Pago da Rapidex>
```

A mensalidade usa uma conta/credencial separada do dinheiro dos pedidos. O cancelamento da renovação fica disponível dentro do painel e o acesso já pago é preservado até `access_ends_at`.

## Mercado Pago dos restaurantes

```text
RAPIDEX_MP_CLIENT_ID=
RAPIDEX_MP_CLIENT_SECRET=
```

O restaurante autoriza a própria conta por OAuth. Tokens ficam criptografados por `restaurant_id`; Pix só aparece quando aquela loja está conectada.

## WhatsApp Embedded Signup / Meta Tech Provider

```text
RAPIDEX_META_APP_ID=
RAPIDEX_META_APP_SECRET=
RAPIDEX_META_EMBEDDED_SIGNUP_CONFIG_ID=
RAPIDEX_META_SOLUTION_ID=        # opcional/conforme arquitetura de Partner Solution
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_GRAPH_VERSION=v25.0
```

Antes de liberar conexão para restaurantes reais, configurar no ecossistema Meta:

- Meta Business Portfolio do Rapidex;
- Meta App do tipo Business;
- WhatsApp Business Platform e Tech Provider conforme elegibilidade/revisão vigente;
- Facebook Login for Business com configuração de WhatsApp Embedded Signup;
- permissões `whatsapp_business_management` e `whatsapp_business_messaging` aprovadas quando exigidas;
- domínio/HTTPS e JavaScript SDK autorizados;
- webhook público apontando para `/api/webhooks/whatsapp` e verify token configurado.

## Recuperação de senha / e-mail transacional

```text
RESEND_API_KEY=
RAPIDEX_EMAIL_FROM=
```

O domínio/remetente deve estar verificado antes de liberar clientes pagantes.

## IA

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

Sem OpenAI, o sistema mantém respostas locais seguras e o estado do carrinho; transcrição de áudio exige a integração ativa.

## Storage de fotos

Fotos ainda dependem de object storage real. Não armazenar binários no PostgreSQL. Na Vercel, a direção recomendada é usar object storage (ex.: Vercel Blob) e persistir somente chave/URL no banco. Enquanto storage não estiver provisionado, não anunciar upload de fotos como ativo.

## Infra / Vercel

O repositório ficou conectado historicamente a três projetos Vercel. `vercel.json` possui `ignoreCommand` para permitir build apenas no projeto oficial `rapidexmenu` e evitar consumo triplo de cota nos projetos legados.

O Preview READY de 07/08/2026 confirmou em runtime de build:

- PostgreSQL acessível;
- migrations automáticas funcionando;
- migrations 0004–0007 aplicadas no Preview;
- Next.js 16 / Node 22 compilando e publicando corretamente.

Migrations 0008/0009 precisam ser verificadas no Preview do head que as contém antes do merge.

## Antes de abrir aquisição paga

- CI verde no head exato a ser mergeado;
- Preview do mesmo head READY;
- migrations 0001–0009 verificadas no banco de Preview;
- executar cadastro -> importação -> horários -> publicação -> pedido -> recebimento -> entrega;
- validar recomendação -> aceite -> atribuição no Profit Engine;
- validar isolamento entre pelo menos duas lojas;
- confirmar e-mail de recuperação;
- confirmar assinatura sandbox/conta de teste e webhook;
- confirmar Mercado Pago por vendedor ou deixar Pix explicitamente desabilitado;
- concluir Meta Embedded Signup com conta/número de teste e validar texto + áudio + pedido + status + track + repeat;
- publicar identidade jurídica real, CNPJ e contato de suporte nos documentos legais;
- configurar monitoramento/alertas de erros;
- rotacionar/remover qualquer segredo histórico que tenha sido versionado em repositórios antigos;
- manter backup/recuperação do PostgreSQL compatível com o plano contratado.

## Critério para dizer “pronto para comercializar”

O código estar em produção não é suficiente. O sinal verde exige no mínimo:

- autenticação nativa ativa;
- PostgreSQL operacional e migrado;
- cadastro/onboarding/importação aprovados ponta a ponta;
- cardápio/pedido/acompanhamento aprovados;
- horários e pausa de operação aprovados;
- Profit Engine medindo atribuição sem inflar faturamento;
- cobrança Rapidex ou processo comercial alternativo definido;
- recuperação de acesso funcional;
- pagamentos/WhatsApp anunciados apenas quando as respectivas conexões estiverem efetivamente ativadas;
- documentos legais com dados reais da empresa;
- suporte/contato real publicado.
