# RapidexMenu — Backup, RPO/RTO e Disaster Recovery

Status: operacional para HMG/pilotos; critérios de produção ainda dependem de retenção/backup e object storage definitivos.

## 1. Objetivos de recuperação

Os objetivos abaixo são limites máximos aceitos. Eles não significam que o ambiente já os cumpre automaticamente; o gate de produção só fecha quando a infraestrutura e os testes demonstrarem o atendimento.

| Ambiente | Dados | RPO alvo | RTO alvo |
| --- | --- | ---: | ---: |
| HMG / pilotos controlados | pedidos, clientes, catálogo e configuração | 1 hora | 4 horas |
| Produção pública | pedidos, pagamentos, clientes e configuração | 15 minutos | 2 horas |
| Produção pública | catálogo e mídia | 1 hora | 4 horas |

**RPO** é a perda máxima de dados aceita entre o último ponto recuperável e o incidente. **RTO** é o tempo máximo entre a declaração do desastre e a reabertura segura do serviço.

Se a infraestrutura contratada não conseguir sustentar esses objetivos, a aquisição pública deve permanecer bloqueada até ajuste de plano, retenção ou mecanismo de backup.

## 2. Dados críticos

O plano de continuidade deve cobrir em conjunto:

- PostgreSQL: tenants, usuários, catálogo, opções, estoque, pedidos, pagamentos, consentimentos, auditoria e jobs;
- object storage definitivo: fotos de produtos/lojas e derivados;
- configuração de ambiente: variáveis e integrações, mantidas no provedor e nunca dentro de backup de código;
- GitHub: código, migrations e documentação necessários para reconstruir a aplicação.

## 3. Política mínima de backup

### HMG / piloto

1. preservar capacidade de recuperação do PostgreSQL oferecida pelo provedor;
2. criar snapshot/branch identificado antes de migration crítica ou alteração destrutiva relevante;
3. executar restore drill periódico em cópia isolada;
4. manter evidência do drill no repositório em `docs/evidence/`;
5. nunca testar restauração destruindo a branch principal de HMG.

O projeto Neon de HMG observado em 13/08/2026 reportou retenção de histórico de 21.600 segundos (6 horas). Isso é evidência do ambiente atual, não uma garantia suficiente para o gate de produção.

### Produção

Antes do lançamento público, a política deve ser revisada contra o plano contratado e comprovar, por evidência do provedor e drill, que o RPO de produção é atendido. Mudanças de schema críticas exigem ponto de recuperação pré-release.

## 4. Procedimento de recuperação do PostgreSQL

1. **Declarar o incidente.** Registrar horário, impacto, último estado confiável e responsável pela decisão.
2. **Conter.** Se houver risco de corrupção progressiva, suspender mutações/pedidos antes de recuperar.
3. **Preservar evidência.** Não apagar a branch afetada. Criar uma cópia/snapshot quando o provedor permitir.
4. **Escolher o ponto de recuperação.** Priorizar o ponto mais recente anterior ao evento causador, respeitando consistência financeira e de pedidos.
5. **Restaurar em branch isolada.** Nunca apontar o aplicativo diretamente para uma restauração ainda não validada.
6. **Validar marcador de ambiente.** `rapidex_environment.environment` deve corresponder ao ambiente que receberá a restauração.
7. **Validar schema e migrations.** Executar o mecanismo oficial `scripts/migrate-postgres.mjs`; migration aplicada não pode ter checksum alterado.
8. **Executar validação de dados.** Conferir contagens e amostras de tenants, pedidos, produtos, pagamentos e auditoria; investigar qualquer divergência material.
9. **Executar health + CI/E2E.** O fluxo empresa → cardápio → pedido → operação → tracking deve passar contra a cópia restaurada antes do cutover.
10. **Fazer cutover controlado.** Atualizar apenas a referência segura ao banco restaurado; não copiar segredos para Git.
11. **Smoke test pós-cutover.** Health, autenticação, loja pública, checkout e admin devem ser revalidados.
12. **Reabrir.** Somente após o responsável declarar consistência operacional.
13. **Pós-incidente.** Registrar causa, RPO/RTO realmente atingidos, dados perdidos (se houver), ações preventivas e responsáveis.

## 5. Critérios obrigatórios antes do cutover

A restauração não pode virar banco ativo se qualquer um destes itens falhar:

- marcador de ambiente incorreto;
- migrations/checksums inconsistentes;
- isolamento multi-tenant falhando;
- divergência financeira/pedido sem explicação;
- health vermelho;
- E2E crítico falhando;
- credenciais de ambiente misturadas.

## 6. Recuperação de mídia

Enquanto imagens estiverem armazenadas no PostgreSQL, o restore do banco cobre os bytes existentes, mas isso não fecha o gate de **object storage definitivo**. Depois da migração para Blob/R2/S3 ou equivalente, o runbook deve incluir:

- versionamento/retention conforme capacidade do provedor;
- restauração de objeto e metadado/chave correspondente;
- validação de isolamento por tenant;
- lifecycle de órfãos sem remover objetos ainda referenciados;
- teste de consistência entre banco restaurado e mídia restaurada.

## 7. Evidência atual

O primeiro restore drill está registrado em `docs/evidence/RESTORE_DRILL_2026-08-13.md`. Ele usou uma branch Neon descartável, simulou perda total dos pedidos e alteração de schema somente na cópia, confirmou que HMG permaneceu intacta e restaurou a cópia ao estado do parent.

Esse drill comprova o mecanismo de recuperação para o estado corrente do parent. Ainda falta, para fechar o gate completo de produção, testar a release com migration `0026` em uma cópia restaurada, validar E2E contra essa cópia e incluir o object storage definitivo.
