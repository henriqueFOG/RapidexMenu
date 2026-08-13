# RapidexMenu — gates externos de prontidão comercial

Este arquivo impede que dependências externas sejam confundidas com “feature implementada”. Um gate só vira concluído com evidência real (conta, documento, teste ou aprovação correspondente).

## 1. Estrutura empresarial

- [ ] CNPJ/entidade contratante definida.
- [ ] Conta bancária empresarial definida.
- [ ] Titularidade da marca/domínio confirmada pela entidade.
- [ ] Contratos de colaboradores/fornecedores com cessão de propriedade intelectual quando aplicável.
- [ ] GitHub/Vercel/Neon/DNS/Meta/Mercado Pago/OpenAI/e-mail sob contas controladas pela empresa.
- [ ] MFA habilitado nas contas críticas.
- [ ] Pelo menos duas pessoas autorizadas para recuperação de contas críticas, quando houver equipe.

## 2. Jurídico / LGPD

- [ ] Termos revisados por profissional jurídico no Brasil.
- [ ] Política de Privacidade revisada.
- [ ] DPA/contrato de tratamento definido.
- [ ] Papel controlador/operador documentado por fluxo.
- [ ] Canal real de privacidade/encarregado publicado.
- [ ] Lista de subprocessadores revisada.
- [ ] Transferências internacionais avaliadas.
- [ ] Prazos de retenção aprovados.
- [ ] Procedimento de incidente/ANPD revisado.

A aplicação já versiona aceite; isso não substitui revisão jurídica do conteúdo aceito.

## 3. Mercado Pago — assinatura Rapidex

- [ ] Conta da Rapidex definitiva.
- [ ] Credencial de produção configurada apenas no ambiente correto.
- [ ] Assinatura inicial real/teste oficial aprovada.
- [ ] Renovação validada.
- [ ] Cancelamento validado.
- [ ] Falha/pausa validada.
- [ ] Grace period confirmado com comportamento real do provedor.
- [ ] Webhook + reconciliação periódica validados.
- [ ] Evidência de que dinheiro da Rapidex está separado do dinheiro das lojas.

## 4. Mercado Pago — pagamentos das lojas

- [ ] App OAuth de produção criado/aprovado.
- [ ] redirect URI/domínios corretos.
- [ ] Loja teste conecta conta própria.
- [ ] Pix real/sandbox oficial criado.
- [ ] Webhook válido e repetido testado.
- [ ] Webhook perdido simulado e reconciliação confirma o pagamento.
- [ ] Cancelamento/expiração/erro não marcam pedido como pago.

## 5. Meta / WhatsApp

- [ ] Business Portfolio da Rapidex.
- [ ] Meta App Business.
- [ ] Embedded Signup configurado.
- [ ] Permissões/revisões exigidas aprovadas.
- [ ] domínio e SDK autorizados.
- [ ] número de teste/produção conectado.
- [ ] webhook assinado validado.
- [ ] texto, áudio, pedido, acompanhamento e transferência humana validados.
- [ ] templates e consentimento revisados para campanhas.
- [ ] custos da Meta incorporados à unit economics.

## 6. OpenAI / IA

- [ ] Projeto/conta empresarial apropriada.
- [ ] chave exclusivamente server-side.
- [ ] budget/limites configurados.
- [ ] monitoramento de custo por tenant.
- [ ] política de dados/subprocessadores refletida nos documentos legais.
- [ ] red-team de prompts concluído antes de automação em escala.

## 7. E-mail transacional

- [ ] domínio/remetente verificado.
- [ ] SPF/DKIM/DMARC conforme provedor/domínio.
- [ ] recuperação de senha entregue em provedores comuns.
- [ ] bounce/complaint monitorados.
- [ ] remetente e contato comercial reais.

## 8. Storage / mídia

- [ ] object storage definitivo provisionado.
- [ ] credenciais por ambiente.
- [ ] política de retenção/exclusão.
- [ ] backup/replicação conforme risco.
- [ ] CDN/cache validado.
- [ ] migração do fallback PostgreSQL concluída antes de escala.

## 9. Backup e disaster recovery

- [ ] política de backup compatível com o plano do banco.
- [ ] RPO definido.
- [ ] RTO definido.
- [ ] restauração real executada em cópia isolada.
- [ ] migrations + E2E executados sobre o banco restaurado.
- [ ] evidência do teste guardada.
- [ ] recuperação do storage incluída no runbook.

## 10. Produção / observabilidade

- [ ] domínio definitivo.
- [ ] ambiente produção isolado de HMG.
- [ ] `CRON_SECRET` configurado.
- [ ] monitoramento de uptime externo.
- [ ] error tracking/APM.
- [ ] alertas de pagamento/webhook/fila/5xx.
- [ ] canal de suporte real.
- [ ] status/incidentes com responsável definido.

## Regra de aceite

Nenhum item acima deve ser marcado automaticamente por commit, deploy ou texto de documentação. Exige validação externa real e, quando aplicável, evidência guardada no runbook/registro de mudança.
