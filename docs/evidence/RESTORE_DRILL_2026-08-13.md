# RapidexMenu HMG — Restore drill 2026-08-13

## Objetivo

Registrar evidência verificável para o checklist de prontidão comercial, seção **2.10 Backup e recuperação**, sem alterar o banco principal de HMG.

## Ambiente

- Neon project: `shy-pine-28730393` (`rapidexmenu-hmg-db`)
- Parent/HMG branch: `main` (`br-noisy-night-acswy0kl`)
- Temporary restore branch: `restore-drill-2026-08-13` (`br-wild-cherry-act9wnhy`)
- Database: `neondb`
- Environment marker: `hmg`
- PostgreSQL: 17
- Project history retention observed during the drill: 21,600 seconds (6 hours)

## Baseline copied from HMG

Immediately after branching the live HMG database, the disposable branch contained:

- restaurants: **3**
- orders: **7**
- products: **8**
- environment marker: **hmg**
- migrations: **24**
- latest migration: `0025_catalog_version.sql`

## Destructive simulation — disposable branch only

To prove that recovery restores both data and schema, the disposable branch was deliberately modified:

1. a sentinel table `rapidex_restore_drill_sentinel` was created;
2. a sentinel row was inserted;
3. all rows in `orders` were deleted **only on the disposable branch**.

Verification before restore:

- disposable branch orders: **0**
- sentinel table present: **yes**
- live HMG main branch orders: **7**
- sentinel table on live HMG: **no**

This confirmed branch isolation before executing recovery.

## Recovery execution

The disposable branch was reset from its parent HMG branch using Neon branch recovery. No change was applied to `main`.

Verification after reset:

- restaurants: **3**
- orders: **7**
- products: **8**
- environment marker: **hmg**
- sentinel table present: **no**

The simulated destructive data loss and schema mutation were therefore removed, and the disposable copy returned to the parent's current state.

## Checklist assessment

This drill provides direct evidence that a real copy of the HMG PostgreSQL database can be isolated, destructively modified and restored to the current parent state without touching HMG.

It **does not by itself close every item in 2.10**. The following remain separate gates:

- define and approve production RPO/RTO;
- establish a production backup retention policy beyond the current HMG history window;
- automate backup/snapshot policy where appropriate;
- run the application migrations and full E2E against a restored production-like copy after the release containing migration `0026`;
- include definitive object storage/media recovery in the same continuity plan.

## Safety note

All destructive operations in this drill were performed only on Neon branch `br-wild-cherry-act9wnhy`. The parent HMG branch remained at 3 restaurants / 7 orders / 8 products throughout the destructive simulation.
