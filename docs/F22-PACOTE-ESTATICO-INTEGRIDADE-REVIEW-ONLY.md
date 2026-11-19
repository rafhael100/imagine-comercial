# F22 — Prévia de integridade do pacote estático

Referência: 09/11/2026. Estado: **laboratório; uso apenas para revisão, não publicação.**

## Objetivo
Produzir um inventário determinístico do diretório Astro dist depois que as verificações de HTML, SEO, catálogo assinado e QA de navegador terminarem. O relatório contém o caminho relativo, tamanho e SHA-256 de cada arquivo e um digest SHA-256 do inventário ordenado.

Esses hashes permitem **comparar bytes entre cópias** se uma referência confiável do digest for guardada separadamente. Eles **não são assinatura digital**, não provam procedência ou aprovação, e não permitem validar autoria por si só.

## Contratos verificáveis
- As rotas HTML precisam ser exatamente as 15 páginas públicas curadas em sitePages, mais 404.html, sem páginas extras ou ausentes.
- robots.txt, sitemap.xml e 404.html são obrigatórios.
- Caminhos relativos devem ser seguros, sem traversal/segmentos ocultos.
- Rejeitar _redirects, _headers, wrangler.toml, package.json, .env, source maps e tipos não homologados.
- Não aceitar symlinks ou nós especiais no diretório.
- Limites de segurança de laboratório: 500 arquivos, 10 MiB por arquivo, 50 MiB no total.
- O relatório é gravado exclusivamente em artifacts/release-review/REVIEW-ONLY-static-build-sha256.json; o diretório dist não recebe manifestos, chaves, regras de deploy ou dados operacionais.
- O workflow GitHub Actions apenas anexa o relatório imagine-comercial-release-REVIEW-ONLY por 7 dias. Não recebe privilégios de escrita.

## Cenários de teste
tests/release-review.test.mjs verifica ordenação reprodutível, detecção de adulteração de bytes, omissão de HTML, rotas inesperadas, URLs/arquivos privados, regras de deploy, duplicação, limites de tamanho e quantidade.

O CI executa node scripts/prepare-release-review.mjs **após o QA de navegador**. A conclusão do CI é requisito para afirmar que a geração foi validada.

## O que continua proibido ou pendente
Não há assinatura por chave operacional, aprovação editorial autenticada, autorização multiempresa, token do Portal, pós-build atestado de terceiro, publicação em Cloudflare, staging protegido ou garantia de indexação. Uma pessoa mal-intencionada capaz de alterar arquivos e o manifesto pode recomputar todos os hashes; é indispensável uma cadeia de confiança independente antes do deploy.

**Bloqueios inalterados:** inventário GSC, 301 por URL, política de privacidade/portfólio, checkout e fiscal, Portal MFA/controle de funções, homologação e autorização expressa para produção.
