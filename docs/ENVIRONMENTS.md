# RapidexMenu — HMG e Produção

## Regra de promoção

`feature/agent -> hmg -> validação E2E -> master`

- `hmg`: ambiente de homologação permanente. Pode receber dados de teste, migrations novas e integrações sandbox/teste.
- `master`: produção. Só recebe promoção depois da homologação aprovada.
- PR #6 permanece como promoção futura para `master` enquanto HMG é validada.

## Isolamento obrigatório

| Recurso | HMG | Produção |
| --- | --- | --- |
| Branch | `hmg` | `master` |
| Vercel | projeto `rapidexmenu-hmg` | projeto `rapidexmenu` |
| URL | `https://rapidexmenu-hmg.vercel.app` ou domínio HMG | `https://rapidexmenu.com.br` |
| `RAPIDEX_ENV` | `hmg` | `production` |
| PostgreSQL | instância/banco exclusivo HMG | instância/banco exclusivo PROD |
| Sessão | segredo exclusivo HMG | segredo exclusivo PROD |
| Integrações | contas/ativos teste | contas/ativos reais |
| Cobrança Rapidex | desativada | ativa |

## Proteções implementadas

1. O projeto Vercel de produção só pode construir `master`.
2. Projetos Vercel antigos ficam ignorados.
3. Um projeto HMG só pode construir `hmg` quando `RAPIDEX_ENV=hmg`.
4. HMG recusa o domínio oficial de produção.
5. HMG recusa `RAPIDEX_BILLING_MP_ACCESS_TOKEN` para impedir mensalidade real.
6. O migrador cria `rapidex_environment` no PostgreSQL e bloqueia migrations quando o ambiente do banco diverge do deploy.
7. O CI roda em `master`, `hmg` e na branch comercial.

## Configuração do projeto Vercel HMG

Criar um projeto novo chamado `rapidexmenu-hmg`, ligado ao repositório `henriqueFOG/RapidexMenu` e à branch `hmg`.

Configurar, sem copiar segredos de produção:

- `RAPIDEX_ENV=hmg`
- `RAPIDEX_PUBLIC_URL=https://rapidexmenu-hmg.vercel.app`
- `RAPIDEX_AUTH_MODE=native`
- `RAPIDEX_SIGNUP_ENABLED=true`
- `DATABASE_URL=<PostgreSQL exclusivo HMG>`
- `RAPIDEX_SESSION_SECRET=<novo segredo HMG 32+>`
- `RAPIDEX_INTEGRATION_SECRET=<novo segredo HMG 32+>`

Manter `RAPIDEX_BILLING_MP_ACCESS_TOKEN` vazio em HMG.

As demais integrações devem usar ativos de teste separados. O arquivo `.env.hmg.example` é a lista canônica.

## Configuração de produção

O projeto existente `rapidexmenu` fica ligado somente a `master` e usa `.env.production.example` como contrato de nomes. Segredos nunca são versionados.

## Banco

O primeiro deploy de cada banco registra seu ambiente em `rapidex_environment`. Depois disso:

- deploy HMG + banco PROD => build/migration BLOQUEADO;
- deploy PROD + banco HMG => build/migration BLOQUEADO.

Isso não substitui bancos separados: a tabela é uma segunda camada de defesa.

## Gate para promover HMG -> PROD

- CI verde em `hmg`;
- `/api/health` informa `environment=hmg` e `environmentSafe=true`;
- migrations 0001–0009 verificadas no banco HMG;
- cadastro, importação, horários, publicação e pedido E2E aprovados;
- isolamento entre duas lojas aprovado;
- Profit Engine aprovado;
- pagamentos em sandbox aprovados;
- WhatsApp de teste aprovado quando credenciais Meta estiverem disponíveis;
- nenhuma variável/conta de produção usada durante HMG.

Só depois disso promover para `master`.
