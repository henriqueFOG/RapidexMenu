# RapidexMenu — suporte, severidade e incidentes

Este documento define o modelo operacional. Tempos contratuais finais só devem ser publicados depois que houver equipe/cobertura capaz de cumpri-los consistentemente.

## Severidades

### P0 — venda/operação crítica indisponível

Exemplos:

- pedidos não podem ser criados para múltiplas lojas;
- exposição de dados entre tenants;
- pagamentos marcados incorretamente de forma sistêmica;
- perda/corrupção relevante de dados;
- autenticação comprometida;
- indisponibilidade ampla do cardápio público.

Ação: contenção imediata, responsável técnico único, preservação de evidências, atualização frequente do status interno e comunicação externa quando houver impacto confirmado.

### P1 — função crítica degradada

Exemplos:

- WhatsApp oficial falha, mas cardápio web continua operando;
- Pix falha para uma integração/loja e há pagamento alternativo;
- novos pedidos chegam com atraso significativo;
- upload/storage indisponível sem impedir pedidos existentes.

Ação: priorizar no ciclo operacional atual, usar fallback seguro e evitar perda de pedidos/dados.

### P2 — função importante com workaround

Exemplos:

- relatório incorreto sem alterar valores financeiros gravados;
- configuração administrativa específica falha;
- notificação do navegador não toca, mas fila mostra pedido.

### P3 — dúvida, melhoria ou problema visual

Não interrompe venda/operação e possui workaround simples.

## Ordem de prioridade durante incidente

1. isolamento de dados e segurança;
2. integridade financeira;
3. criação/processamento de pedidos;
4. disponibilidade do cardápio;
5. integrações externas;
6. relatórios e automações;
7. experiência visual.

## Registro mínimo de incidente

- identificador;
- início percebido e início confirmado;
- ambiente;
- tenants afetados;
- impacto em pedidos/pagamentos/dados;
- mudança/deploy relacionado;
- contenção aplicada;
- causa raiz;
- dados recuperados ou reconciliados;
- comunicação realizada;
- ação preventiva;
- responsável e data de conclusão.

## Suporte dos pilotos

Nos primeiros pilotos, cada restaurante precisa ter:

- contato responsável da loja;
- canal de suporte definido no onboarding;
- janela operacional da loja;
- procedimento de fallback para receber pedido caso um canal externo falhe;
- autorização clara para alterações de configuração feitas pela equipe Rapidex.

## SLA comercial

Não publicar números de SLA no site/contrato até a capacidade de atendimento ser medida. Internamente, medir:

- tempo até primeiro reconhecimento;
- tempo até contenção;
- tempo até recuperação;
- reincidência em 30 dias;
- incidentes por 1.000 pedidos.

Depois de 30–60 dias de pilotos reais, definir níveis contratuais compatíveis com a distribuição observada, com margem operacional.

## Pós-mortem

P0 e P1 relevantes exigem pós-mortem sem culpabilização individual, focado em:

- por que o sistema permitiu o incidente;
- por que monitoramento/teste não detectou antes;
- como reduzir probabilidade;
- como reduzir impacto caso se repita;
- quais gates de deploy/checklist precisam mudar.

Ação preventiva deve entrar no backlog com prioridade, proprietário e evidência de conclusão.
