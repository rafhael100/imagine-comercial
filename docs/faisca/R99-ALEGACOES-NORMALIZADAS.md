# Faísca R99 — alegações comerciais com caracteres de compatibilidade

PR draft empilhada na R98 #573, sem impacto público e sem uso real de API.

## Defeito reproduzível

`Ｒ＄　５００`, `ｐａｇａｍｅｎｔｏ ｆｏｉ ａｐｒｏｖａｄｏ` e `ｃｏｎｔｒａｔｏ ｆｏｉ ａｓｓｉｎａｄｏ` são convertidos por `NFKC` em frases que violam os controles financeiros/operacionais. Os filtros anteriores testavam o texto original, portanto podiam não enxergar uma alegação inventada no retorno privado Luna/Terra mesmo com receitas editoriais válidas.

## Implementação e evidências

- Normalização `NFKC` antes das verificações independentes de alegações em `live-lab.mjs` e `private-review-http.mjs`, mantendo a resposta original sob controle do restante da validação.
- Testes Node/HTTP sintéticos em `tests/faisca-r99-normalized-claim-egress.test.mjs` exercitam casos fixos com fontes exatas, conversa fictícia livre e adaptador Responses API substituído por fixture. Nenhuma chamada é enviada à OpenAI.
- Comandos: `node --test tests/faisca-r98-unicode-decimal-egress.test.mjs tests/faisca-r99-normalized-claim-egress.test.mjs`; em CI, executar também Chromium/axe, Onepage/PHP, PostgreSQL descartável e build/SEO.

## Gates ainda abertos

- CI 6/6 na HEAD exata R99 e revisão independente AppSec/editorial.
- Homologação da conversa R95–R99 em staging privado autorizada por operador, com SHA/política/ledger/preflight. A homologação R92 relatada pelo operador continua registrada, mas não certifica R99.
- Revisão de **alucinações semânticas**: normalização e regex não provam veracidade, completude ou LGPD. A contratação Onepage depende de identidade, autoridade, oferta, contrato, aceite e recibos no Portal.
- `publicFaiscaEnabled=false`, mascote, site público e `main` preservados; nenhuma ativação, merge, deploy, DNS, VPS, dados/segredos reais, LLM pago, leads, tickets ou cobranças.
