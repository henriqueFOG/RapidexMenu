# RapidexMenu — registro do ativo e contas críticas

Preencher este documento com identificadores empresariais reais antes de due diligence, captação ou transferência de operação. **Nunca colocar senhas, tokens, recovery codes ou segredos aqui.**

## Software e propriedade intelectual

| Ativo | Titular esperado | Evidência | Status |
|---|---|---|---|
| Repositório RapidexMenu | Empresa | organização/contrato GitHub | [ ] |
| Código-fonte | Empresa | contratos/cessão de PI | [ ] |
| Marca RapidexMenu | Empresa | protocolo/registro aplicável | [ ] |
| Domínio principal | Empresa | conta registrador + faturamento | [ ] |
| Design/logotipo/copy proprietária | Empresa | autoria/cessão/licenças | [ ] |

## Infraestrutura

| Serviço | Conta/Workspace empresarial | MFA | Dois responsáveis | Cobrança empresarial | Status |
|---|---|---|---|---|---|
| GitHub | [ ] | [ ] | [ ] | [ ] | [ ] |
| Vercel | [ ] | [ ] | [ ] | [ ] | [ ] |
| Neon/PostgreSQL | [ ] | [ ] | [ ] | [ ] | [ ] |
| Object storage | [ ] | [ ] | [ ] | [ ] | [ ] |
| DNS/registrador | [ ] | [ ] | [ ] | [ ] | [ ] |
| E-mail transacional | [ ] | [ ] | [ ] | [ ] | [ ] |
| Observabilidade | [ ] | [ ] | [ ] | [ ] | [ ] |

## Integrações comerciais

| Serviço | Finalidade | Titular | Produção isolada | Rotação/recovery documentada | Status |
|---|---|---|---|---|---|
| Mercado Pago Rapidex | mensalidade SaaS | [ ] | [ ] | [ ] | [ ] |
| Mercado Pago OAuth | pagamentos das lojas | [ ] | [ ] | [ ] | [ ] |
| Meta Business/App | WhatsApp Embedded Signup | [ ] | [ ] | [ ] | [ ] |
| OpenAI API | IA/transcrição | [ ] | [ ] | [ ] | [ ] |

## Dados e continuidade

- [ ] PostgreSQL de produção é separado de HMG.
- [ ] backup/retention do banco documentados.
- [ ] restore foi testado em cópia isolada.
- [ ] RPO/RTO definidos.
- [ ] storage possui política de backup/retenção coerente.
- [ ] processo de exportação de dados do cliente/tenant existe.
- [ ] processo de encerramento/portabilidade de tenant existe.
- [ ] política de retenção LGPD aprovada.

## Pessoas e acesso

- [ ] lista de administradores de produção revisada.
- [ ] menor privilégio aplicado.
- [ ] desligamento de colaborador revoga acessos no mesmo processo.
- [ ] recovery de conta não depende de telefone/e-mail pessoal inacessível à empresa.
- [ ] nenhum segredo de produção depende exclusivamente de máquina local do fundador.
- [ ] deploy/rollback pode ser executado por segunda pessoa treinada quando houver equipe.

## Dependências e licenças

- [ ] Dependabot ativo.
- [ ] audit de dependências em CI.
- [ ] scan de segredos em CI.
- [ ] inventário de dependências principais revisado.
- [ ] licenças incompatíveis com uso comercial identificadas/removidas.
- [ ] avisos/licenças exigidos preservados.

## Documentos operacionais

- [x] checklist técnico/comercial versionado no repositório.
- [x] decisões de arquitetura registradas.
- [x] runbook de piloto existente.
- [x] severidade/incidente/SLA interno documentado.
- [x] processo comercial/ativação documentado.
- [ ] runbook definitivo de produção validado.
- [ ] contatos/escalas reais preenchidos.
- [ ] evidência de restore anexada ao registro operacional.

## Regra de due diligence

“Existe no código” e “a empresa controla o ativo” são evidências diferentes. Para cada serviço crítico, guardar fora do repositório a prova apropriada de titularidade, faturamento, domínio, contratos, aprovações e testes de continuidade.
