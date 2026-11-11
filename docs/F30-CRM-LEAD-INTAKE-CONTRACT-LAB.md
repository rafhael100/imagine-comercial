# F30 — Contrato sintético para captação Comercial → CRM Imagine

Data: 09/11/2026. **Somente desenvolvimento e testes sem rede.** Não há formulário, endpoint, webhook, integração CRM ou dados pessoais reais.

## Problema resolvido em laboratório

O site Comercial hoje oferece WhatsApp e e-mail e informa corretamente que o formulário integrado ao Portal depende de homologação. Antes de criar uma rota pública de captura, é útil estabelecer quais dados mínimos podem ser submetidos, como validar consentimento e como impedir duplicidades por retry. A F30 prepara esse contrato sem coletar dados reais.

## Entrada do modelo de laboratório

Os únicos campos admitidos são `name`, `email`, `phone`, `serviceSlug`, `details`, `consent` e `honeypot`.

- Nome de contato de 3–120 caracteres, sem conteúdo de cabeçalhos, marcação HTML ou caracteres de controle.
- E-mail de até 254 caracteres, normalizado para minúsculas, obrigatório no modelo inicial.
- Telefone opcional, quando informado em formato internacional E.164.
- Serviço obrigatório entre os seis slugs do catálogo curado, sem aceitar valores arbitrários da URL.
- Descrição do interesse de 10–1.600 caracteres, preservada como texto puro, nunca como HTML executável.
- Consentimento explícito de contato `true` e campo isca `honeypot` necessariamente vazio.
- Campos extras e omissões são rejeitados, incluindo possíveis dados pessoais desnecessários.

## Idempotência e privacidade

A classe `SyntheticLeadInbox` usa UUID v4 e guarda o conteúdo **somente em memória**, dentro do próprio teste Node. Uma repetição com o mesmo UUID e os mesmos dados recebe confirmação de duplicata, sem criar novo registro. Reutilizar o UUID para dados alterados gera conflito. O recibo demonstrativo expõe apenas ID opaco, modo sintético e resultado, nunca nome, e-mail, telefone ou mensagem.

**Este comportamento NÃO equivale a idempotência durável em múltiplos servidores**; após reinicialização a memória desaparece. Requer chave única persistida no CRM, transação, fila, retries, reconciliação e prazo de retenção aprovados.

## O que falta antes de habilitar captação pública

1. Definir e publicar aviso de privacidade final aprovado, finalidade do contato, versão e comprovação de consentimento, acessível no formulário.
2. Implementar endpoint do Portal/CRM com autenticação de serviço, controles de origem, limites de taxa, antibot e validação repetida no servidor.
3. Associar organização/tenant e serviço elegível sem confiar em IDs enviados pelo navegador. O site Comercial não deve possuir segredos de API.
4. Definir ciclo de vida dos leads, acesso por permissões, exclusão, auditoria, resposta idempotente e falhas com fila/reenvio.
5. Testes de ponta a ponta, incluindo segurança LGPD, com dados fictícios e depois staging protegido, antes de qualquer lançamento.

Não há mudanças em `main`, deploy, credenciais, custos, dados de clientes nem formulário ativado.
