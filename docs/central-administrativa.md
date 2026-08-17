# Central Administrativa RapidexMenu

## Diretriz do produto

A Central é o centro de comando da RapidexMenu. Ela deve permitir que a equipe interna resolva problemas de clientes, estabelecimentos, pagamentos, integrações e infraestrutura sem recorrer a alterações manuais e arriscadas no banco.

O objetivo não é criar uma tela com acesso irrestrito e invisível. A Central deve oferecer grande poder operacional com segurança, confirmação, motivo obrigatório e auditoria para cada ação sensível.

## Identidades separadas

Existem três grupos independentes:

1. **Administradores da plataforma**: proprietário, administradores, suporte e leitura. Acessam `/central`.
2. **Usuários de estabelecimentos**: proprietários, gerentes, operadores e financeiro. Acessam o painel do restaurante conforme os vínculos da tabela `members`.
3. **Consumidores**: clientes que compram nas lojas. Seus dados e pedidos ficam isolados por estabelecimento.

Uma pessoa pode acumular vínculos quando isso for concedido explicitamente, mas nenhum vínculo deve ser inferido pelo nome da loja ou pelo simples fato de um e-mail estar configurado em variável de ambiente.

## Perfis internos

| Perfil | Leitura | Operação | Estabelecimentos | Suporte de acesso | Gerenciar admins |
| --- | --- | --- | --- | --- | --- |
| Proprietário | Sim | Sim | Sim | Sim | Sim |
| Administrador | Sim | Sim | Sim | Sim | Não |
| Suporte | Sim | Não | Não | Sim | Não |
| Somente leitura | Sim | Não | Não | Não | Não |

O primeiro proprietário pode ser inicializado uma única vez pelo e-mail seguro do ambiente. Depois disso, a autorização é feita pela tabela `platform_admins`, e não pela variável.

## Regras de segurança

- Senhas nunca são exibidas, recuperadas ou definidas por atendentes.
- Redefinições usam links temporários e de uso único; links anteriores são invalidados.
- Ações sensíveis exigem justificativa de atendimento.
- Toda ação administrativa gera um registro em `platform_audit_logs`.
- O menor privilégio é o padrão; somente o proprietário gerencia outros administradores.
- Segredos de infraestrutura nunca são enviados ao navegador.
- Acesso assistido a uma loja deve ser temporário, sinalizado e auditado; não deve reutilizar a sessão do titular.
- Ações destrutivas devem preferir bloqueio/arquivamento reversível e exigir confirmação reforçada.

## Evolução do centro de comando

### Fundação

- RBAC de administradores da plataforma.
- Cadastro de novos administradores com primeiro acesso seguro.
- Recuperação de senha assistida e auditada.
- Separação entre Central e painel do estabelecimento.
- Saúde de infraestrutura, jobs, receita e estabelecimentos.

### Suporte operacional

- Busca global por loja, usuário, pedido, pagamento, telefone e protocolo.
- Linha do tempo unificada do cliente e do estabelecimento.
- Bloquear/desbloquear conta, revogar sessões e reenviar convite.
- Acesso assistido temporário e visível ao estabelecimento.
- Reprocessar jobs, webhooks e conciliações com idempotência.

### Operação comercial

- Cadastrar estabelecimento e convidar proprietário sem aceitar termos em seu nome.
- Gerenciar plano, trial, cobrança, créditos e cancelamento.
- Funil de ativação, churn, MRR, NRR e alertas de risco.
- Segmentação e tarefas de sucesso do cliente.

### Governança e escala

- MFA obrigatório para administradores internos.
- Aprovação em duas etapas para ações de alto impacto.
- Exportação de auditoria e retenção configurável.
- Alertas de comportamento anômalo e acessos suspeitos.
- Runbooks incorporados para incidentes e recuperação.

## Critério de produto

Cada ferramenta da Central deve responder a quatro perguntas:

1. Resolve um problema real sem depender de acesso direto ao banco?
2. Reduz tempo de suporte, risco operacional ou perda de receita?
3. Respeita isolamento de estabelecimentos e privilégio mínimo?
4. Deixa evidência suficiente para explicar e desfazer a ação?

Se a resposta não for positiva para as quatro, a ferramenta ainda não está pronta para produção.

## Política de build e publicação

- Alterações devem ser acumuladas e verificadas primeiro com testes e build local.
- Nenhuma alteração deve ser publicada automaticamente na Vercel.
- O deploy só acontece após aprovação explícita do Henrique para o pacote validado.
- Pedidos sucessivos devem ser agrupados em uma única publicação sempre que possível, preservando o limite de builds.
- A versão publicada precisa corresponder exatamente ao commit aprovado e validado localmente.
