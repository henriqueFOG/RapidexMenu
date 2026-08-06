# Checklist de lançamento

## Bloqueadores de produção

- [ ] definir `RAPIDEX_OWNER_EMAIL`;
- [ ] decidir CNPJ, conta bancária e entidade contratante;
- [ ] revisar Termos, Privacidade e DPA com jurídico;
- [ ] configurar domínio próprio e e-mail transacional;
- [ ] ativar D1/R2 e validar migrações;
- [ ] configurar backup e restaurar uma cópia de teste;
- [ ] adicionar chave OpenAI com limite de gasto;
- [ ] conectar app Meta, número, template e webhook;
- [ ] conectar Mercado Pago, chave Pix e webhook de Order;
- [ ] executar compra Pix de teste e confirmar idempotência;
- [ ] testar texto, áudio, humano, falha e reenvio do WhatsApp;
- [ ] configurar monitoramento de erro e disponibilidade;
- [ ] criar processo de opt-out e direitos LGPD;
- [ ] executar revisão de segurança antes de mudar acesso para público.

## Aceite funcional

- [ ] cardápio abre em celular 360 px e desktop;
- [ ] preço alterado no navegador não afeta total do servidor;
- [ ] produto indisponível bloqueia checkout;
- [ ] pedido repetido não duplica;
- [ ] pedido aparece na fila em até 30 segundos;
- [ ] estados inválidos são bloqueados;
- [ ] token acompanha sem expor endereço;
- [ ] Pix pendente não aparece como pago;
- [ ] assinatura inválida retorna 401;
- [ ] evento repetido não processa novamente;
- [ ] usuário de outro restaurante não acessa os dados;
- [ ] upload rejeita HTML/SVG e arquivo acima do limite;
- [ ] logs não contêm token, endereço ou corpo bruto.

## Go-to-market

- [ ] 50 contas ICP mapeadas em Petrópolis;
- [ ] 15 entrevistas concluídas;
- [ ] 10 design partners assinados;
- [ ] roteiro de onboarding de 60 minutos;
- [ ] baseline de pedido, ticket, atraso e margem;
- [ ] dashboard de ativação e retenção;
- [ ] canal de suporte e SLA definidos;
- [ ] política de preço fundador aprovada;
- [ ] estudo de caso só publicado com autorização e dados verificados.

## Operação diária

- [ ] revisar webhook falho;
- [ ] revisar pagamento pendente acima de 30 minutos;
- [ ] revisar conversa transferida para humano;
- [ ] verificar fila e promessa fora do intervalo;
- [ ] tratar opt-out no mesmo dia;
- [ ] responder incidente crítico imediatamente;
- [ ] publicar status quando houver impacto ao pedido.

## Critério para abrir acesso público

Abrir somente quando os bloqueadores técnicos, jurídicos e de pagamento estiverem concluídos e pelo menos três restaurantes tiverem operado sete dias sem incidente grave. Até lá, manter acesso restrito e usar o Programa Fundadores.
