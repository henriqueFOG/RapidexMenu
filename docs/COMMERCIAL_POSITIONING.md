# RapidexMenu — posicionamento comercial 2026

## O que não é diferencial suficiente

O mercado já oferece cardápio digital, atendimento automatizado, recuperação de vendas, PDV, estoque, cupons, fidelidade e relatórios. O RapidexMenu não deve ser vendido como “mais um sistema que recebe pedidos no WhatsApp”.

## Categoria e promessa

**Categoria:** sistema de crescimento e lucro para o canal direto de restaurantes.

**Promessa principal:** receber pedidos é o começo; o Rapidex ajuda o restaurante a aumentar recompra e contribuição e mostra quanto resultado conseguiu atribuir às próprias ações.

Frase curta:

> Venda é bom. Saber o que sobrou é melhor.

Mensagem de comparação, sem atacar concorrente:

> Se você já usa outro sistema para receber pedidos, compare o que acontece depois do pedido: margem, recompra, promessa de entrega e ROI atribuído.

## Diferenciais que precisam aparecer no produto

### 1. Profit Engine

- preço e custo por produto;
- margem de contribuição por pedido;
- recomendação de complemento baseada em margem, histórico de compra conjunta e pressão da cozinha;
- registro de recomendação exibida e aceita;
- receita e contribuição adicionadas por upsell;
- produtos com margem perigosa destacados antes de campanhas.

### 2. ROI atribuído, não faturamento fantasiado de ROI

O painel separa faturamento normal, contribuição dos pedidos, receita adicionada por ações mensuráveis, contribuição adicionada, receita recuperada, mensalidade e ROI atribuído. Nunca atribuir todo o faturamento do canal direto ao Rapidex.

### 3. Operação que protege a experiência

- promessa de entrega considera fila e capacidade;
- recomendações penalizam itens demorados quando a cozinha está pressionada;
- painel mede precisão da promessa;
- transições de pedido são controladas no servidor.

### 4. Dinheiro e dados pertencem à operação correta

- multiempresa por restaurant_id;
- credencial de Pix por restaurante via OAuth;
- cobrança da mensalidade usa credencial separada da plataforma;
- Pix só aparece quando aquela loja estiver conectada;
- preço sempre recalculado no servidor.

### 5. Confiança como produto

- trial claro de 14 dias;
- cancelamento da renovação dentro do painel;
- acesso continua até o fim do período já pago;
- sem comissão Rapidex por pedido;
- termos e privacidade acessíveis;
- recuperação de senha sem intervenção manual.

## ICP inicial

Priorizar hamburguerias, pizzarias, açaí, comida japonesa e marmitaria/delivery recorrente, com aproximadamente 300 a 3.000 pedidos/mês, ticket entre R$35 e R$90 e dono ou gestor ainda acompanhando margem, atendimento e campanhas. Não começar disputando grandes redes por profundidade de ERP/PDV.

## Oferta

### Começo — R$97/mês

Cardápio próprio, pedidos e acompanhamento, Profit Engine básico, lucro/contribuição e ROI, Pix quando a conta do restaurante estiver conectada, pagamento na entrega e zero comissão Rapidex por pedido.

### Crescimento — R$297/mês

Tudo do Começo + WhatsApp e vendedor com IA quando a integração estiver ativada, memória e recompra, automações de recuperação, Guardião de margem e atribuição avançada de receita recuperada.

### Escala — R$597/mês

Tudo do Crescimento + múltiplas unidades, permissões, fila/operação mais avançada e integrações prioritárias conforme implementação contratada.

Não anunciar como disponível uma integração que ainda esteja sem credencial/ativação no ambiente.

## Funil self-service

1. visitante entende a tese na landing;
2. calcula oportunidade em `/calculadora`;
3. inicia trial em `/cadastro`;
4. cria loja e primeiro cardápio;
5. publica;
6. recebe primeiro pedido;
7. vê contribuição e Profit Engine;
8. conecta Mercado Pago se quiser Pix;
9. escolhe plano;
10. cancela a renovação no próprio painel se não perceber valor.

## Métrica que decide se o produto funciona

**North Star:** contribuição incremental atribuída ao Rapidex por restaurante ativo.

Métricas secundárias: ativação em 48h, taxa de recomendação aceita, contribuição adicionada por upsell, recompra incremental, receita recuperada, ROI atribuído/mensalidade, precisão da promessa, trial -> pago, churn e motivo do cancelamento.

## Regra para desenvolvimento

Antes de adicionar uma funcionalidade porque um concorrente possui, perguntar:

1. Isso é requisito mínimo para o cliente trocar/testar?
2. Isso fortalece Profit Engine, recompra, operação ou confiança?
3. Conseguimos medir seu efeito?
4. O cliente perceberá valor nas primeiras 48 horas?

Se a resposta for “não” para quase tudo, não priorizar no piloto comercial.
