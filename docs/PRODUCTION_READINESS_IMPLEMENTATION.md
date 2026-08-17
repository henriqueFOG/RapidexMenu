# RapidexMenu — execução para produção

Atualizado em 17/08/2026. Este é o checklist operacional desta rodada. Um item só recebe `[x]` quando existe implementação, teste e evidência compatível com o risco.

## Regra de publicação

- [x] Trabalhar sobre o mesmo código publicado em HMG (`b7a7d8b56926fc049a26d1fae2a0ce4f96dbed28`).
- [x] Não publicar cada ajuste individualmente.
- [x] Exigir marcador explícito `[deploy:hmg]`/`[deploy:prod]` para impedir build remoto em push comum.
- [ ] Executar um único deploy de HMG somente após o novo pacote local ficar verde.
- [ ] Promover para produção somente quando código, infraestrutura e dependências externas obrigatórias estiverem concluídos.

## P0 técnico — antes dos pilotos

- [x] Baseline: typecheck e 70 testes unitários verdes antes das alterações.
- [x] Remover automaticamente tenants criados pelo E2E público.
- [x] Excluir dados sintéticos das métricas comerciais da Central.
- [x] Identificar demonstração e teste separadamente de estabelecimento real.
- [x] Colocar produção em cadastro por convite; HMG pode permanecer aberto para validação.
- [x] Adicionar páginas próprias de erro e 404.
- [x] Reduzir informações técnicas expostas no health check público.
- [x] Cobrir Central, comprador, estabelecimento e isolamento entre tenants nas suítes E2E.
- [x] Executar as suítes E2E contra o deploy único `b7a7d8b` de HMG.
- [ ] Validar instalação e operação móvel/PWA em preview; dispositivo físico continua como gate externo.

## P0 Central administrativa

- [x] Cadastrar estabelecimento com primeiro acesso seguro.
- [x] Pausar, reativar e bloquear estabelecimento com motivo e auditoria.
- [x] Alterar plano, trial e janela de acesso com motivo e auditoria.
- [x] Consultar detalhes operacionais de cada estabelecimento.
- [x] Gerenciar membros do estabelecimento sem misturar identidade de superadmin.
- [x] Bloquear/desbloquear usuário e encerrar sessões.
- [x] Alterar perfil e revogar superadmin, protegendo o último proprietário.
- [x] Consultar auditoria pela interface.
- [x] Registrar notas e histórico de suporte.
- [x] Manter redefinição de senha por link temporário; nunca exibir ou escolher a senha do titular.

## P0 segurança e dados

- [x] MFA TOTP obrigatório para superadmins em produção.
- [x] Sessão administrativa exigir segundo fator válido e expirar separadamente.
- [x] Criar modo de banco com usuário de aplicação de privilégio mínimo.
- [x] Documentar estratégia de RLS/isolamento e adicionar verificação automatizada.
- [x] Adicionar gate de produção que falha com configuração insegura ou incompleta.
- [x] Impedir que e-mails/domínios de teste entrem em produção.
- [x] Travar no código o proprietário canônico `henry.francisco31@hotmail.com` e impedir Heloisa na Central.
- [ ] Confirmar no banco de produção que existe exatamente o proprietário canônico e que todos os superadmins ativos concluíram MFA.

## P0 confiabilidade e operação

- [x] Configurar rota de manutenção e execução diária compatível com HMG/Hobby.
- [ ] 🔒 Validar Vercel Pro com frequência de 5 minutos ou agendador externo equivalente antes de clientes.
- [x] Distinguir integração inativa de incidente real no painel.
- [x] Instrumentar erros e sinais operacionais sem registrar PII/segredos.
- [x] Adicionar Web Analytics, Speed Insights e canal HTTPS opcional para alertas operacionais críticos.
- [x] Criar verificação de readiness para produção.
- [x] Padronizar Node 22 no código, CI e documentação de Vercel.
- [x] Documentar aposentadoria dos projetos Vercel antigos.
- [x] Implementar limpeza diária de mídia órfã para R2/Vercel Blob, com carência e limites.

## Validação local desta rodada

- [x] TypeScript sem erros.
- [x] ESLint sem erros ou avisos.
- [x] 101 testes unitários/contratuais aprovados.
- [x] Histórico D1 aplicado do zero e validado automaticamente.
- [x] Varredura de 381 arquivos versionados ou pendentes sem segredo detectado.
- [x] Auditoria das dependências de produção sem vulnerabilidade conhecida.
- [x] Build local consolidado Vercel/Next concluído após typecheck, lint, testes, auditoria e secret scan.
- [ ] Inspeção visual no navegador remoto: bloqueada pelo ambiente antes de alcançar a aplicação; repetir em HMG.

## Auditoria externa somente leitura — 17/08/2026

- [x] Domínio oficial associado ao projeto Vercel correto.
- [x] HMG atual responde com aplicação, PostgreSQL e autenticação operacionais.
- [ ] 🔒 Ajustar Vercel de produção de Node 20 para Node 22.
- [ ] 🔒 Ajustar Vercel HMG de Node 24 para Node 22.
- [ ] 🔒 Substituir no domínio oficial a release antiga configurada como homologação somente depois de todos os gates.
- [ ] 🔒 Criar/confirmar Neon exclusivo de produção; hoje só há HMG nomeada e uma base genérica antiga incompleta.
- [ ] 🔒 Retirar integrações e excluir `rapidexmenu-v2` somente após confirmação destrutiva e prova de ausência de tráfego/dados necessários.

Evidência detalhada em `docs/READINESS_AUDIT_2026-08-17.md`.

## P0 externo — antes de cobrar clientes

- [ ] 🔒 Criar banco Neon exclusivo de produção e credencial de aplicação limitada.
- [ ] 🔒 Configurar object storage/CDN definitivo de produção.
- [ ] 🔒 Configurar domínio e e-mail transacional reais.
- [ ] 🔒 Configurar cobrança da RapidexMenu ou processo comercial/fiscal manual formal.
- [ ] 🔒 Validar ciclo real de assinatura: pagamento, renovação, recusa, grace, cancelamento e reativação.
- [ ] 🔒 Validar Pix real e webhooks do Mercado Pago se o recurso for anunciado.
- [ ] 🔒 Validar Meta/WhatsApp e OpenAI reais se forem anunciados.
- [ ] 🔒 Definir CNPJ/entidade, conta bancária, Termos, Privacidade, DPA e canal LGPD.
- [ ] 🔒 Contratar backup adequado, definir RPO/RTO e executar restore do ambiente de produção.
- [x] Executar restore drill atualizado da release HMG até migration `0031`, preservando o parent e removendo a cópia temporária.
- [ ] 🔒 Configurar monitoramento externo, alertas e responsáveis de suporte.
- [ ] 🔒 Ativar MFA nas contas GitHub, Vercel, Neon, DNS, Meta, Mercado Pago, OpenAI e e-mail.

## Gate comercial

- [ ] Três estabelecimentos reais operaram pelo menos sete dias sem incidente grave.
- [ ] Onboarding foi concluído sem intervenção técnica do fundador.
- [ ] Existe evidência de primeiro pagamento e ao menos uma renovação real.
- [ ] Métricas de ativação, pedidos, retenção, suporte e custo usam somente dados reais.
- [x] Landing e planos qualificam recursos dependentes de integração e não prometem disponibilidade automática.

## P1 — depois do piloto, antes da escala

- [ ] Conta opcional do comprador com histórico, endereços e preferências; checkout convidado continua disponível.
- [ ] Segmentação, recompra, abandono e atribuição de margem completos.
- [ ] Notificações em segundo plano, impressão e estações avançadas de KDS conforme demanda dos pilotos.
- [ ] Load test, p95/p99 e orçamento de capacidade por tenant.
- [ ] Integrações PDV/ERP/fiscal/logística priorizadas por demanda comprovada.
- [ ] Impersonação somente se necessária, com consentimento, motivo, prazo e auditoria.
