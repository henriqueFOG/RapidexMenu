# Segurança, privacidade e LGPD

Este documento descreve a base técnica e operacional. A versão comercial final de Termos, Política de Privacidade, DPA e contratos deve ser revisada por profissional jurídico no Brasil.

## Modelo de acesso

- gestão protegida por identidade injetada pelo Sign in with ChatGPT;
- autorização server-side por restaurante e papel;
- papéis: proprietário, gerente, operação e financeiro;
- APIs públicas limitadas a cardápio, pedido, lead, mídia pública e acompanhamento por token;
- nenhuma confiança em `restaurantId`, preço, custo ou status enviados pelo navegador;
- primeira conta pode reivindicar a loja demo somente quando não há proprietário configurado; em produção, definir `RAPIDEX_OWNER_EMAIL`.

## Isolamento multiempresa

- todas as tabelas operacionais possuem `restaurant_id`;
- consultas administrativas derivam o restaurante da associação autenticada;
- atualizações incluem `id` e `restaurant_id` no `WHERE`;
- arquivos públicos ficam em prefixo por restaurante;
- integrações mapeiam identificadores externos ao restaurante sem guardar token bruto no banco.

## Pedidos e pagamentos

- preço, custo, subtotal e margem são recalculados pelo servidor;
- `clientOrderId` evita duplicidade de checkout;
- numeração é reservada no banco;
- acompanhamento usa token aleatório de alta entropia;
- Pix usa idempotency key por pedido;
- webhook Mercado Pago exige assinatura HMAC e consulta a Order API antes de atualizar;
- webhook nunca confia apenas no corpo recebido para marcar pagamento como pago.

## WhatsApp e IA

- GET de verificação exige token configurado;
- POST exige `X-Hub-Signature-256` sobre o corpo bruto;
- evento é deduplicado antes de processamento;
- áudio é transcrito sem persistir o arquivo bruto;
- saída do modelo segue JSON Schema;
- preço, disponibilidade e margem vêm do banco;
- a IA não recebe endereço, e-mail ou outros dados desnecessários;
- reclamação, alergia, cancelamento e reembolso mudam a conversa para humano;
- campanha exige aprovação e consentimento.

## Uploads

- apenas proprietário/gerente;
- JPG, PNG e WebP;
- máximo de 5 MB;
- conteúdo servido com `nosniff` e tipo armazenado no R2;
- nome aleatório e prefixo público dedicado;
- SVG e HTML não são aceitos.

## Proteções gerais

- limite de corpo por endpoint;
- rate limit persistente para pedido e lead;
- verificação de origem em mutações administrativas;
- validação e normalização de entrada;
- erros públicos não incluem stack trace ou segredo;
- trilha de auditoria para produto, pedido, automação e configuração;
- segredos somente no ambiente, nunca em Git, D1 ou resposta do navegador.

## LGPD — mapa mínimo

| Dado | Finalidade | Base a definir/documentar | Retenção inicial sugerida |
|---|---|---|---|
| nome, telefone e endereço | executar pedido/entrega | execução de contrato | prazo fiscal/defesa e depois minimização |
| histórico de pedidos | suporte, recompra e análise | contrato/legítimo interesse conforme caso | enquanto conta ativa + política definida |
| consentimento WhatsApp | comprovar autorização | consentimento | enquanto válido + prova do evento |
| preferências | facilitar recompra | consentimento ou legítimo interesse avaliado | até revogação/inatividade |
| mensagens | atender e resolver disputa | contrato/legítimo interesse | janela curta configurável |
| lead comercial | contato solicitado | consentimento/procedimento preliminar | 6 meses sem interação, como ponto de partida |
| auditoria | segurança e prevenção a fraude | legítimo interesse/obrigação | 12–24 meses, conforme análise |

As bases legais e prazos definitivos dependem do papel contratual do RapidexMenu (controlador ou operador em cada fluxo) e de avaliação jurídica.

## Direitos do titular

Antes do go-live público, implementar processo para:

- confirmar tratamento;
- exportar dados em formato legível;
- corrigir cadastro;
- registrar opt-out imediatamente;
- eliminar ou anonimizar quando cabível;
- informar compartilhamentos relevantes;
- registrar prazo e conclusão da solicitação.

## Retenção e descarte

- configurar retenção por categoria, não apagar indiscriminadamente;
- separar obrigação fiscal de marketing;
- anonimizar métricas após fim da necessidade identificável;
- R2 deve ter rotina de exclusão de objetos órfãos;
- payload bruto de webhook não é armazenado; guarda-se hash, tipo e estado.

## Incidente

1. Conter integração/chave afetada.
2. Preservar auditoria sem copiar dados pessoais desnecessários.
3. Identificar restaurantes e titulares potencialmente afetados.
4. Rotacionar segredos e revogar tokens.
5. Avaliar comunicação à ANPD e titulares com apoio jurídico.
6. Corrigir causa, validar e documentar post-mortem.

## Antes de abrir ao público

- definir proprietário inicial por ambiente;
- configurar backup e teste de restauração;
- criar política de privacidade, termos e DPA;
- criar canal de encarregado/privacidade;
- configurar opt-out e solicitação de titular;
- executar revisão de segurança e teste de webhook;
- monitorar erro, latência, fila e falha de integração;
- revisar subprocessadores e transferência internacional de dados.
