# Evidência de restauração HMG — 17/08/2026

## Escopo

- ambiente: HMG;
- banco: `rapidexmenu-hmg-db`, região São Paulo;
- release de referência: `b7a7d8b56926fc049a26d1fae2a0ce4f96dbed28`;
- execução: cópia isolada; a branch principal de HMG não foi alterada;
- branch temporária: `restore-drill-2026-08-17-b7a7d8b`, removida ao final.

## Baseline observado

| Evidência | Parent HMG | Cópia isolada inicial |
| --- | ---: | ---: |
| Ambiente | `hmg` | `hmg` |
| Migrations | 30 | 30 |
| Última migration | `0031_maintenance_schedules.sql` | `0031_maintenance_schedules.sql` |
| Fingerprint das migrations | `d348a99f047a23e82a8905d81fbb6bb5` | `d348a99f047a23e82a8905d81fbb6bb5` |
| Tabelas | 44 | 44 |
| Estabelecimentos | 6 | 6 |
| Usuários | 17 | 17 |
| Pedidos | 10 | 10 |
| Produtos | 14 | 14 |
| Superadmins | 1 | 1 |

## Procedimento executado

1. Criada uma branch copy-on-write a partir da branch principal de HMG.
2. Confirmados ambiente, migrations, fingerprint, schema e contagens críticas.
3. Criada somente na cópia uma tabela-canário `restore_drill_canary` com uma linha.
4. Confirmado que a tabela-canário não existia no parent, provando isolamento.
5. A cópia foi resetada a partir do parent, descartando a alteração simulada.
6. Após o reset, a tabela-canário não existia e todos os valores do baseline voltaram a coincidir exatamente.
7. A branch temporária foi excluída para não gerar custo ou confusão operacional.

## Resultado

**APROVADO para HMG/pilotos controlados.** O mecanismo de cópia isolada e restauração do estado atual foi exercitado com migrations até `0031`, sem impacto no banco principal. A mesma release já passou pelo E2E completo de HMG, incluindo pedidos, concorrência, isolamento multi-tenant, filas, cron e PWA.

Este drill não fecha o gate de produção pública: o plano atual mantém somente 6 horas de histórico, não inclui object storage definitivo e ainda não comprova o RPO de 15 minutos/RTO de 2 horas definido para produção.
