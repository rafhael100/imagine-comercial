# Faísca R54 — correção de respostas durante o pós-venda anônimo

**Base:** R53 draft #521; somente laboratório de revisão, `publicFaiscaEnabled=false`.

## Problema e solução

A triagem permite corrigir assunto, serviço e detalhe após a terceira escolha, mas não apresentava controles de correção durante a jornada. Quem percebesse um erro antes do fim precisava avançar com dados errados ou recomeçar. A R54 mostra **Corrigir assunto** assim que assunto foi selecionado, e **Corrigir serviço** assim que serviço foi selecionado, enquanto o próximo campo é perguntado. Não oferece correção para campos não selecionados. As correções existentes continuam limpando o campo alterado e respostas dependentes.

## Arquivos da R54

- `ops/faisca/support/journey.mjs`: apenas construção das ações locais para exibir correções válidas durante as perguntas.
- `tests/faisca-r54-support-partial-correction.test.mjs`: quatro regressões para escolhas, descarte de dependências, ação forjada, inexistência de ticket e ausência de fontes externas.
- Este documento.

## Revisão e testes

```sh
node --test tests/faisca-r52-support-actions.test.mjs tests/faisca-r54-support-partial-correction.test.mjs
node --test tests/faisca-*.test.mjs
npm ci --no-audit --no-fund
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/support/browser-qa.mjs
```

Gates: conferir resultados **na SHA final desta PR**, revisar teclado/leitores de tela e se o excesso de botões afeta visualizações móveis; manter a revisão independente R07–R10 e R53. Nenhuma alteração em `src/`, `public/`, mascote, checkout, CMS, CRM, Portal, provedores IA, infraestrutura, dados reais ou scripts de deploy. Sem merge, publicação, contratos, cobrança ou autenticação.
