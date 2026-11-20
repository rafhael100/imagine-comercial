# Faísca R123 — smoke independente do PNG aprovado em staging privado

A R122 incluiu o mascote aprovado na interface de revisão Luna/Terra. A auditoria R94/R114 conferia de forma exata apenas HTML, JS e CSS: o arquivo PNG poderia ser alterado mantendo rota e políticas aparentes. A R123 incorpora uma **quarta verificação GET somente leitura** no smoke de staging, sem solicitar token e sem acessar a API.

## Controles verificáveis

- Rota privada exata: `/__faisca_openai_private/mascot.png`, após HTML, JS e CSS.
- Cabeçalhos: HTTP 200, `image/png`, `Content-Length: 1887660`, `no-store`, `noindex`, CSP, ausência de CORS e cookies. A política continua independente do servidor testado.
- Conteúdo: leitura binária com tamanho limitado e prazo absoluto, **SHA-256 fixa** `1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d`. O hash esperado está definido na fonte da auditoria e não é descoberto no arquivo recebido.
- `tests/faisca-r94-exact-private-assets-smoke.test.mjs` modifica um byte próximo ao fim do PNG mantendo tamanho, MIME, CSP e as primeiras assinaturas do PNG: o smoke deve barrar o pacote. Também preserva ataques a HTML, JS e CSS.
- `tests/faisca-r113-private-staging-smoke-deadline.test.mjs` e `tests/faisca-r114-private-smoke-header-policy.test.mjs` passam a exigir quatro GETs quando o conteúdo é íntegro, mantendo negativos de timeout e de cabeçalhos.

**Importante:** `PRIVATE_UI_READONLY_VERIFIED` continua sendo um resultado de laboratório. Não prova a versão instalada na VPS, não libera credenciais, não afirma custos reais nem autoriza integração pública. A homologação R92 relatada anteriormente não é repetida; R95+ precisa de revisão operacional separada. Nenhum deploy, merge, DNS, VPS, Portal/CRM operacional, chamada paga, dado real ou cobrança. Site público, mascote original, `main` e `publicFaiscaEnabled=false` preservados.
