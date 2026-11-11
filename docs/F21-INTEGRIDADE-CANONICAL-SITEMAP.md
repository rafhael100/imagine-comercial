# F21 — Integridade 1:1 entre HTML, canonical, OG, robots e sitemap

Data: 09/11/2026. Estado: implementação em PR draft empilhado, sem lançamento.

## Objetivo
Uma página legítima deve emitir **exatamente um** canonical e um `og:url` iguais à sua rota pública aprovada. O sitemap precisa conter **todas e somente** as páginas indexáveis curadas no catálogo `sitePages`, sem omissões, duplicações ou URLs inesperadas.

## Regras no build
1. Para cada um dos HTML gerados, `scripts/verify-dist.mjs` exige canonical único e igual a `toAbsoluteUrl(path)`.
2. O metadado `robots` deve existir uma só vez, com `index,follow` nas páginas públicas. A página 404 segue um contrato separado com `noindex,nofollow`, sem canonical nem JSON-LD indexável.
3. `og:url` deve ser único e coincidir exatamente com o canonical da página correspondente.
4. `sitemap.xml` deve possuir conjunto de `<loc>` igual ao catálogo e sem duplicatas.
5. `robots.txt` deve declarar exatamente um endereço de sitemap, apontando para a URL pública autorizada.

## Testes
- `tests/seo-output-contract.test.mjs`: fixtures sintéticos positivos e negativos para canonical ausente, duplicado ou divergente; divergência de OG; noindex inadvertido; sitemap faltante, duplicado ou com host errado; robots com indicação incorreta.
- `npm test` executa os testes sintéticos antes de instalar dependências; `node scripts/verify-dist.mjs` valida o **build real Astro** no CI.
- O auditor independente Imagine SEO Engine permanece fixado por commit. As novas verificações são complementares, não substitutas.

## Limites
Este controle **não mede indexação no Google, tráfego, Core Web Vitals em campo, rankings, equivalência de redirecionamentos, Search Console ou SEO editorial**. URLs do domínio antigo e releases do Portal exigem auditoria/autorização separadas.

Sem deploy, integração com APIs de cliente, redirecionamentos ativos, merge na `main`, custos externos ou alterações de DNS.
