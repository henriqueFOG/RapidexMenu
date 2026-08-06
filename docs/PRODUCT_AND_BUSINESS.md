# RapidexMenu — produto e modelo de negócio

## Tese

Restaurantes não precisam apenas de mais pedidos. Precisam transformar o canal direto em um ativo rentável: cliente identificado, recompra simples, margem protegida e operação previsível.

**Posicionamento:** o sistema de crescimento para restaurantes que querem vender direto.

**Promessa:** descobrir, pedir, pagar, acompanhar e recomprar sem atrito, especialmente pelo WhatsApp, sem comissão Rapidex por pedido.

**Categoria própria:** *Revenue OS para restaurantes independentes*. “Cardápio digital” descreve a interface; “sistema de crescimento” descreve o valor.

## Cliente ideal inicial

ICP principal:

- hamburguerias, pizzarias, açaí, comida japonesa e marmitaria;
- 300 a 3.000 pedidos/mês;
- ticket médio de R$35 a R$90;
- operação com entrega própria ou parceiro logístico;
- volume relevante no WhatsApp e dependência parcial de marketplace;
- dono ainda envolvido em marketing, atendimento ou operação.

Sinais de urgência:

- mensagens sem resposta em horário de pico;
- atraso ou cancelamento por sobrecarga;
- campanhas baseadas apenas em desconto;
- desconhecimento de margem por produto;
- base de clientes espalhada em celulares pessoais;
- dificuldade em provar se a mensalidade do software se paga.

Não é ICP inicial: redes nacionais com ERP e procurement extensos, restaurante sem operação de entrega, ou loja com menos de 100 pedidos/mês e nenhuma demanda digital validada.

## Diferenciação competitiva

O Anota AI já divulga atendimento automático no WhatsApp, compreensão de texto/áudio e envio do pedido à cozinha. Portanto, “ter IA no WhatsApp” não é diferenciação defensável. Fonte oficial: [Atendente Virtual Anota AI](https://anota.ai/home/funcionalidade/atendente-virtual/).

O iFood oferece aquisição de demanda, pagamentos e logística, mas aplica estrutura de comissão e outras cobranças conforme plano e contrato. A própria documentação pública informa percentuais padrão e recomenda conferir as condições vigentes no Portal do Parceiro. Fonte oficial: [taxas iFood](https://blog-parceiros.ifood.com.br/taxas-ifood/).

| Dimensão | Anota AI | iFood | RapidexMenu |
|---|---|---|---|
| Papel principal | automatizar atendimento/pedido | marketplace e logística | aumentar valor do canal próprio |
| WhatsApp texto/áudio | sim | não é o núcleo | sim, com memória e transferência humana |
| Aquisição de novos clientes | limitada ao canal do restaurante | forte | parceiros e campanhas próprias |
| Comissão Rapidex por pedido | não aplicável | há comissão conforme plano | **zero** |
| Memória para “o de sempre” | não usar como pressuposto competitivo | conta do marketplace | **núcleo do produto** |
| Otimização por margem | não usar como pressuposto competitivo | foco amplo de marketplace | **custo + estoque + capacidade** |
| Promessa baseada na fila | não usar como pressuposto competitivo | recursos de tempo/logística | **fila do canal direto** |
| ROI de recompra recuperada | não usar como pressuposto competitivo | métricas do marketplace | **receita incremental explicada** |
| Relação com cliente | canal do restaurante | mediada pelo marketplace | **ativo do restaurante, com consentimento** |

Estratégia: não vender “abandone o iFood”. O marketplace pode continuar como aquisição; o Rapidex maximiza a recompra e a margem no relacionamento direto legitimamente construído pelo restaurante.

## Produto

### Fluxo do cliente

1. Abre link/QR Code ou conversa no WhatsApp.
2. Descobre produtos disponíveis.
3. Recompra usando preferências anteriores.
4. Confirma endereço, itens e pagamento.
5. Recebe Pix ou escolhe pagamento na entrega.
6. Acompanha o pedido por token não adivinhável.
7. Recebe relacionamento futuro somente com consentimento.

### Fluxo do restaurante

1. Configura loja, custo, preço, estoque e capacidade.
2. Recebe pedidos em fila única.
3. Avança estados com transições controladas.
4. Revisa oportunidades geradas pela IA.
5. Aprova campanhas; o sistema aplica consentimento e guardrails.
6. Mede venda direta, contribuição, recompra e receita recuperada.

### Guardrails do vendedor

- nunca inventar produto, preço, disponibilidade ou status;
- nunca concluir pedido sem confirmação explícita;
- alergias, reclamações, cancelamentos e reembolsos vão para humano;
- campanha sem consentimento não é enviada;
- desconto não é criado autonomamente;
- recomendação usa apenas produto disponível e respeita margem;
- dados pessoais não entram em prompts além do mínimo necessário.

## Planos e embalagem

### Começo — R$97/mês

- cardápio, link e QR Code;
- pedidos ilimitados;
- Pix e pagamento na entrega;
- painel operacional e relatório essencial.

Objetivo: reduzir barreira de entrada e criar caminho de upgrade.

### Crescimento — R$297/mês

- tudo do Começo;
- vendedor com IA no WhatsApp;
- memória de preferências;
- recuperação e recompra;
- Guardião de margem;
- ROI de receita recuperada.

Plano principal. A demonstração e o discurso comercial devem ancorar aqui.

### Escala — R$597/mês

- tudo do Crescimento;
- até 3 unidades;
- KDS/fila inteligente;
- papéis e permissões;
- integrações e suporte prioritário.

Expansões futuras: unidade adicional, volume de conversas de IA, onboarding assistido e parceiro logístico. Tarifas de Meta, IA e meios de pagamento devem ser transparentes e podem ter franquia ou repasse; nunca escondidas como “comissão”.

## Economia unitária — metas, não promessas

Premissas ilustrativas para gestão:

- mix: 45% Começo, 45% Crescimento, 10% Escala;
- ARPA misto: R$237/mês;
- margem bruta alvo: 80%;
- churn de logos alvo após maturidade: menor que 2,5% ao mês;
- CAC máximo recomendado: R$900;
- payback de CAC alvo: até 5 meses;
- LTV/CAC alvo: maior que 4×.

Com 100 clientes no mix acima: MRR de R$23.700 e ARR de R$284.400. Com 500 clientes: MRR de R$118.500 e ARR de R$1.422.000. Esses valores são aritmética do mix, não previsão de vendas.

Se a contribuição média após custos variáveis for R$190 por cliente e a estrutura fixa mensal for R$25 mil, o ponto de equilíbrio ilustrativo é cerca de 132 clientes. O modelo financeiro deve ser atualizado mensalmente com custo real de Meta, OpenAI, pagamentos, suporte e infraestrutura.

## North Star e métricas

**North Star:** receita de recompra e recuperação gerada pelo canal próprio com margem mínima preservada.

Métricas de produto:

- ativação: loja publicada + primeiro pedido real em até 48h;
- time-to-value: tempo até o primeiro pedido direto;
- taxa de checkout concluído;
- pedidos por conversa do WhatsApp;
- percentual de pedidos “o de sempre”;
- precisão da promessa de entrega;
- taxa de transferência para humano;
- falhas/repetições de webhook;
- margem de contribuição por pedido.

Métricas de negócio:

- MRR novo, expansão e contração;
- churn de logos e receita;
- ARPA e margem bruta;
- CAC, payback e LTV/CAC;
- PQLs: restaurantes que publicaram cardápio ou receberam pedido;
- ativação D2, retenção W4 e NRR;
- receita recuperada/mensalidade por cliente.

## Roadmap orientado a risco

### Agora — piloto comercial

- D1 multiempresa, fila, CRM, cardápio e checkout;
- WhatsApp oficial, áudio e transferência humana;
- Pix e confirmação por webhook;
- custo/margem por produto;
- automação sempre aprovada por humano;
- trilha de auditoria e consentimento.

### Próximo — prova de retenção

- onboarding guiado e importação de cardápio;
- templates de WhatsApp e opt-out automático;
- zonas de entrega e cálculo de frete;
- KDS por estação;
- coortes, recompra e testes de mensagem;
- assinatura recorrente do SaaS.

### Depois — expansão defensável

- previsão de capacidade e ruptura;
- múltiplas unidades e franquias;
- integração fiscal/ERP/POS;
- parceiro logístico sob demanda;
- benchmark anônimo por categoria, somente com governança adequada;
- API e ecossistema de parceiros.

## Riscos e respostas

| Risco | Resposta |
|---|---|
| “É só outro cardápio” | vender recompra, margem e ROI; cardápio é meio |
| Anota AI copiar funcionalidades | aprofundar memória, margem, capacidade e dados de resultado |
| dependência da Meta | adaptador desacoplado, templates, monitoramento e canal web funcional |
| custo de IA crescer | modelo econômico por intenção, fallback determinístico e limites por plano |
| restaurante não configurar custo | onboarding assistido e margem desconhecida sinalizada, nunca inventada |
| IA cometer erro | saída estruturada, dados do servidor e transferência humana |
| churn por baixa ativação | concierge nos primeiros 14 dias e meta de primeiro pedido em 48h |
| fraude/duplicidade | assinatura, idempotência, consulta ao provedor e auditoria |
| LGPD/marketing indevido | consentimento registrável, opt-out, minimização e política de retenção |

## Decisões que não devem mudar sem evidência

- Brasil e restaurantes independentes primeiro;
- WhatsApp como canal central, mas não único;
- zero comissão Rapidex por pedido;
- Crescimento como plano âncora;
- automação explicável e aprovada;
- margem e capacidade antes de GMV;
- infraestrutura multiempresa desde a primeira versão.
