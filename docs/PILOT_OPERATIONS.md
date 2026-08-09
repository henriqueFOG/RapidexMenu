# RapidexMenu — Operação dos pilotos em HMG

Este documento descreve o mínimo operacional para receber restaurantes reais no ambiente de homologação sem tratar HMG como produção.

## Regra de ambiente

- Pilotos iniciais usam exclusivamente `https://rapidexmenu-hmg.vercel.app`.
- A branch de aplicação é `hmg`.
- O banco é o projeto Neon exclusivo `rapidexmenu-hmg-db`.
- Nunca reutilizar `DATABASE_URL`, sessão ou credenciais de produção.
- Produção só recebe alterações após aprovação explícita e uma rodada própria de validação.

## Backup antes dos pilotos

Foi criado um snapshot do banco HMG antes das alterações de preparação para piloto:

- snapshot: `pilot-backup-2026-08-09`
- finalidade: ponto de retorno anterior à entrada dos primeiros restaurantes reais
- regra: não escrever, migrar ou usar esse branch como banco da aplicação

Antes de uma migração estrutural relevante ou de um teste potencialmente destrutivo no HMG, criar um novo branch/snapshot do banco Neon com nome datado e mantê-lo até a validação terminar.

## Recuperação

Se houver corrupção ou exclusão relevante de dados:

1. interromper mudanças no HMG;
2. identificar o último snapshot conhecido como íntegro;
3. comparar o estado atual com o snapshot antes de restaurar;
4. preservar o banco afetado para investigação;
5. restaurar somente o necessário ou promover uma cópia validada;
6. executar migrations e o E2E completo no ambiente restaurado;
7. só então reabrir o piloto.

Não fazer restauração destrutiva por tentativa e erro.

## Gate obrigatório de cada mudança

Uma alteração só é considerada pronta para pilotos quando passar por:

1. TypeScript e testes unitários;
2. build de produção;
3. migrations em PostgreSQL isolado;
4. E2E comercial completo;
5. teste adversarial de isolamento entre restaurantes;
6. deploy Vercel do HMG;
7. `/api/health` servindo o SHA exato do commit;
8. Playwright contra o HMG público.

## Incidente durante piloto

Prioridade operacional:

1. pedido não chega ou não pode ser processado;
2. exposição de dados entre restaurantes;
3. indisponibilidade de loja/cardápio;
4. perda de dados ou imagem;
5. checkout/acompanhamento quebrado;
6. problemas visuais sem impacto na venda.

Em qualquer suspeita de exposição entre restaurantes, suspender imediatamente o uso afetado até confirmar isolamento.

## Fotos de produtos no piloto

O HMG suporta JPG, PNG e WebP. Quando não houver object storage configurado, as imagens usam fallback no PostgreSQL com limite de 2 MB por arquivo. Essa solução é deliberadamente voltada ao piloto; antes de escalar volume de clientes, migrar a persistência de mídia para object storage mantendo a mesma rota pública de mídia.

## Alertas de pedido

O painel oferece ativação explícita de alertas do navegador. Após a permissão do usuário, o navegador pode emitir notificação e som quando um novo pedido chega. O processamento de pedidos continua independente do alerta; falha de notificação nunca deve impedir a operação do painel.
