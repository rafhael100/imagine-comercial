# F27 — Confronto offline entre Search Console e crawl técnico

Data: 09/11/2026. **Somente teste e revisão, sem requisição HTTP e sem alterar DNS, Cloudflare ou redirects.**

## Motivo

A F26 permite importar as páginas do GSC. Isso não identifica sozinho uma página quebrada em crawl, uma URL legada já redirecionada, uma 404 com backlinks ou uma diferença entre `www` e host apex. A F27 cria um segundo relatório, agora com CSV de crawler, e cruza ambos sem declarar que a correspondência é equivalente editorialmente.

## Entrada esperada

- GSC: exportação local **Páginas** do Search Console, com coluna `Page`, `URL` ou `Páginas principais`.
- Crawl: CSV exportado por crawler, com colunas `Address` ou `Endereço` e `Status Code` ou `Código de status` (ex. Screaming Frog). Nenhum crawler é executado automaticamente; esta etapa apenas lê arquivos privados fornecidos em outro momento.
- Comando de validação fictícia (CI): `node scripts/review-seo-two-sources.mjs --synthetic`.
- Comando exclusivamente local com exportações autorizadas: `node scripts/review-seo-two-sources.mjs --gsc /privado/Pages.csv --crawl /privado/Internal.csv`.

**Não subir arquivos reais para GitHub, CI ou outra ferramenta pública.** Relatórios são gravados em `artifacts/seo-two-source-review/`, pasta ignorada pelo Git e com os parâmetros de query/fragmento omitidos.

## Evidência produzida

- URLs encontradas em GSC mas ausentes no crawler, separadas por host.
- URLs do crawler sem registro GSC, incluindo páginas que ainda podem ter backlinks.
- URLs observadas em ambas as fontes por host, caminho e condição de query/encoding.
- Redirects HTTP 301, 302, 307 ou 308 encontrados **na entrada CSV** que necessitam rastrear sua cadeia final.
- Páginas HTTP 404/410, erros 5xx ou falhas sem resposta que exigem revisão histórica.
- Candidatos presentes nas duas fontes com HTTP 200, ainda marcados como **evidência para análise**, jamais como redirect aprovado.

Se uma URL contém parâmetros, fragmento ou segmentos codificados, a variante permanece em HOLD. O parser rejeita domínios não autorizados, status HTTP inválido e registros duplicados com status contraditório.

## Bloqueios antes de qualquer 301

O relatório não contém lista de aprovação, autorização de responsável, texto integral antigo, métricas verificadas, auditoria de backlinks ou cobertura total de site. Nenhuma regra `_redirects` é produzida. A publicação requer Search Console real, crawl completo e revisão dos pares origem/destino; tratamento editorial e jurídico de idioma, clientes e políticas; staging/observabilidade; e autorização exclusiva para DNS e produção.

A pipeline de CI executa somente fixtures sintéticas; é inadequado subir dados reais de GSC ou crawl ao repositório público.
