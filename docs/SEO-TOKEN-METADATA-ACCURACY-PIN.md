# Comercial — auditor com evidência lexical de metadados

**DRAFT / REVIEW ONLY / NO-MERGE / NO-DEPLOY / NO-DNS.**

O workflow e os dois testes de pin passam de
`e0030209f032a1b95231d6bd208fbe84b06b2341` para a revisão imutável
`e8be80008c802cf14783d02893201e27a31762bb` do Imagine SEO Engine.
O registro de H1 em `SEO-HEADING-ACCURACY-PIN.md` permanece como histórico.

## Correções consumidas

- [Engine #319](https://github.com/rafhael100/imagine-seo-engine/pull/319):
  TITLE real, ignorando exemplos dentro de atributos e delimitando o texto
  após a abertura completa. Preserva os diagnósticos de ausência/duplicação.
- [Engine #320](https://github.com/rafhael100/imagine-seo-engine/pull/320):
  raiz HTML/idioma, SCRIPT JSON-LD e atributos hreflang obtidos pelo lexer e
  parser existentes. Exemplos entre aspas deixam de fornecer evidência falsa,
  produzir alertas indevidos ou consumir quotas de elementos reais.

São mantidos o limite de 128 atributos de META, os 128 scripts JSON-LD,
16 alternates, aspas exigidas, duplicatas críticas, a política literal de
entidades do hreflang, os limites globais e a revisão conservadora de BASE.
O lexer continua estático, sem execução de JavaScript ou reconstrução do DOM.

## Revisão exata do Engine

A revisão `e8be80008c802cf14783d02893201e27a31762bb` fechou em
**7/7 workflows e 11/11 jobs aprovados**, incluindo:

- [Node 22/24](https://github.com/rafhael100/imagine-seo-engine/actions/runs/44229209294):
  **1.101/1.101 testes por versão**, zero falhas, skips ou cancelamentos.
- [F208 Astro/Chromium/Nginx](https://github.com/rafhael100/imagine-seo-engine/actions/runs/44229209139):
  inventários, recibos HTTP do Nginx isolado e navegador aprovados, com
  63 rotas mobile, nove desktop e axe em três páginas por viewport.

A revisão independente dos quatro arquivos da PR #320 não identificou
regressão concreta. Os 1.055 testes do F208 pertencem ao Comercial histórico
fixado naquele workflow; não são o total atual do Engine ou deste Comercial.

## Verificação local do consumidor

Base Comercial: `0bc62faf13fbe461f78c9f751389a9cc093784cd`,
[PR #454](https://github.com/rafhael100/imagine-comercial/pull/454), com
**1.080/1.080 testes** comprovados no CI próprio. A promoção muda somente
o pin, as duas expectativas existentes e este documento.

| Verificação desta promoção | Resultado |
|---|---|
| Testes existentes de pin e Actions imutáveis | 6/6 |
| `npm ci --no-audit --no-fund` antes do build | Concluído |
| Build Astro | 64 páginas, incluindo 404 |
| `verify-dist.mjs` | 63 rotas públicas, sitemap e robots válidos |
| Auditor Engine no SHA novo sobre o dist real | 63 páginas, zero erros e avisos |
| Grafo de navegação | 63 alcançáveis, zero órfãs, máximo três cliques |

O mesmo dist compilado foi auditado depois de fixar a revisão final do Engine;
as mudanças de pin/testes/documentação não alteram as fontes das páginas.
A suíte completa, o navegador e as demais integrações da nova candidata
Comercial devem ser comprovados novamente no CI do seu próprio commit.

Permanecem as flags `--fail-on-warnings --strict-public-head --multilingual
--check-hreflang`, os pins Portal/Actions, permissões e gates. Nenhuma evidência
privada ou consulta à origem pública participa deste commit. Os resultados
não comprovam indexação, ranking, homologação VPS ou aprovação de migração.
