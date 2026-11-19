# Faísca R53 — abertura contextual do pós-venda anônimo

**Base:** R52 draft [#520](https://github.com/rafhael100/imagine-comercial/pull/520), dependente da candidata comercial R51 [#504](https://github.com/rafhael100/imagine-comercial/pull/504). Somente laboratório privado de revisão. `publicFaiscaEnabled=false`.

## Defeito de UX reproduzível

O controlador R10 usa exclusivamente **opções fechadas** e descarta texto digitado (incluindo dados pessoais). Porém `mountFaisca` mostrava por padrão o cumprimento genérico do vendedor, que convida a **escrever uma dúvida**. Isso confundia a pessoa, em especial na triagem pós-venda, onde digitar texto não ajuda e pode induzir a incluir credenciais ou contatos.

## Entrega

- `ops/faisca/ui.mjs`: aceita `sessionPolicy.welcome` **somente de política local já injetada pelo código revisado**, validando descritores sem executar getters. Política ausente conserva `getWelcome()` do vendedor. Corrige inicialização **e reset**.
- `ops/faisca/support/support-ui.mjs`: cumprimento contextual fixo e sem fontes inventadas; diz que não há consulta de cliente, contrato ou pedido, que não aceita dados livres e não abre tickets. Expõe apenas a opção `after_sales`.
- `tests/faisca-r53-support-welcome.test.mjs`: três testes de contrato, imutabilidade e distinção entre vendedor e suporte.
- `ops/faisca/support/browser-qa.mjs`: verifica a mensagem após ativação e depois do reset no Chromium, além das provas existentes de teclado, axe, privacidade, noindex e ausência de egress.

## Gates de reprodução

```sh
node --test tests/faisca-r10-*.test.mjs tests/faisca-r52-*.test.mjs tests/faisca-r53-*.test.mjs
node --test tests/faisca-*.test.mjs
npm ci --no-audit --no-fund
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/support/browser-qa.mjs
```

### Revisão independente Codex/Juliana (somente leitura)

1. Comparar a diff R52→R53 e confirmar que **apenas** `ops/faisca/ui.mjs`, `ops/faisca/support/support-ui.mjs`, `ops/faisca/support/browser-qa.mjs`, testes e documentação foram alterados.
2. Confirmar que `welcome` não aceita valores vindos do DOM, query string, HTTP ou usuário; getters/acessores, campos inesperados ou função ausente são rejeitados.
3. Provar com o navegador que o vendedor retém o cumprimento original, o suporte mostra texto coerente antes/depois de reset, os botões e foco continuam acessíveis, e nenhum nome, e-mail, senha ou telefone é captado.
4. Verificar os workflows da **SHA exata da R53**; erros ou timeout não podem ser tratados como sucesso. Reportar achados por criticidade e conclusão `CHANGES REQUIRED` ou `READY FOR HUMAN REVIEW`.

**Não é produção:** não adiciona contato real, autenticação, cliente, ticket, preço, cobrança, Portal/CRM operacional, IA externa, rede, storage, analytics ou serviços pagos. Sem merge, deploy, DNS, VPS, alterações no mascote ou site público. Todos os gates humanos anteriores permanecem bloqueados.
