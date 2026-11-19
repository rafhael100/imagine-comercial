# Faísca R58 — identificadores fechados no controlador comercial R08

**Base:** R57 #526 (sobre R56 #525), dependente da cadeia R55→R07. A correção paralela de CI da R56 #524 permanece em PR independente. Exclusivamente laboratório sintético/review. `publicFaiscaEnabled=false`.

## Problema

O controlador de suporte R10 já recusava IDs de ação grandes, invisíveis ou de controle (R52). Já o controlador de qualificação R08 aceitava qualquer string no campo `id`, sem um tamanho máximo, antes do despacho, mesmo que a jornada só tenha ações de vocabulário fechado. Um visitante poderia enviar envelopes indevidos e custosos de processar, incluindo caracteres invisíveis, embora o fluxo de estados rejeitasse escolhas não correspondentes.

## Correção executada

- `ops/faisca/qualification/journey.mjs`: `readInput` passa a validar identificadores de ação **ASCII imprimível**, 1–96 caracteres, com a sintaxe `[A-Za-z0-9:_.-]`, preservando o ID existente `r08:contactConsent:*`, sem acionar getters. Entrada de texto R08 continua sujeita ao seu limite atual de 800 caracteres, preservando a interface comercial.
- `tests/faisca-r58-qualification-action-envelope.test.mjs`: regressões para 100 mil caracteres, quebra de linha, NUL, caractere invisível, emoji, espaço, ID vazio/pontuação proibida; aceitação da jornada legítima Onepage e Landing Page; consentimento não modificado; não execução de getters.

O evento inválido produz a mesma resposta neutra já existente e não é refletido no chat nem no resumo. IDs seguros, mas desconhecidos, continuam sujeitos ao fallback do controlador. Nenhuma autoridade, ticket, lead, contato ou integração real é adicionada.

## Testes e gates

```sh
node --test tests/faisca-r58-qualification-action-envelope.test.mjs tests/faisca-r08-journey.test.mjs
node --test tests/faisca-*.test.mjs
npm ci --no-audit --no-fund
IMAGINE_FAISCA_LAB=1 npx --no-install astro build --config ops/faisca/lab/astro.config.mjs
node ops/faisca/journey/browser-qa.mjs
```

Exigir CI na HEAD **R58**, teste de teclado/acessibilidade e revisão independente de compatibilidade da R08/R10. O software real depende de gateway, consentimento, identidade, aprovação de segurança e integração com o Portal/CRM. **Não fazer merge/deploy/DNS/VPS nem alterar mascot, site público, pagamentos, credenciais, clientes ou provedor de IA.**
