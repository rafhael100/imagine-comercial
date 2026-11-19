# Faísca R56 — qualificação conversacional sem eco de texto livre

**Base:** R55 #523, revisão de laboratório. `publicFaiscaEnabled=false`.

## Problema

Durante as perguntas de qualificação Onepage/Landing Page, o adaptador local R09 interpretava respostas em linguagem natural e armazenava somente valores fechados, mas `questionReply` devolvia o texto original na propriedade `userText`. A interface exibia esse texto na conversa; informações adicionais, mesmo irrelevantes, podiam reaparecer no histórico visível. Isso era desnecessário para registrar a seleção e aumentava o risco de exposição incidental.

## Mudanças

- `ops/faisca/qualification/journey.mjs`: ao reconhecer exatamente uma opção, ecoa apenas o rótulo editorial correspondente; em ambiguidade, exibe indicação fixa, sem registrar texto livre. Os campos seguem exclusivamente valores enumerados. O visitante ainda consegue escrever linguagem natural, mas não fornece acesso ao CRM, Portal ou a ações externas.
- `tests/faisca-r56-qualification-safe-echo.test.mjs`: regressões para resposta identificada, ambígua, recusa explícita de contato, ausência de material extra e preservação dos botões.

## Reproduzir

```sh
node --test tests/faisca-r08-journey.test.mjs tests/faisca-r09-field-router.test.mjs tests/faisca-r56-qualification-safe-echo.test.mjs
node --test tests/faisca-*.test.mjs
```

### Gates
- Rever se nenhum texto arbitrário transita de `routeFieldWithLocalFixture` para `userText` após match/ambiguity; validar diferenças com uma correção explícita.
- CI e teste de navegador **na HEAD exata**, não herdar a R55.
- Revisão independente de LGPD/UX, incluindo a distinção entre autorização futura de contato e coleta de identificação. Não declarar segurança completa com base nesses testes.

**Não inclui:** IA externa, armazenamento, autenticação, lead, ticket, pedido, preço, cobrança, alterações de `src/` ou `public/`, VPS, DNS, deploy, merge ou PNG do mascote.
