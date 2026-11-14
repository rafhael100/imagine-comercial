# F11 — Resposta para páginas inexistentes e SEO técnico

## Problema
Uma migração de domínio pode trazer URLs antigas que não terão equivalência. Retornar uma homepage 200 para todas as URLs pode confundir o usuário e os buscadores (soft 404). Precisamos de resposta HTTP 404 verdadeira e uma página de erro útil.

## Entregue
- `src/pages/404.astro`: página de erro alinhada ao layout da Imagine, com navegação para serviços, contato e início.
- Metadados `noindex,nofollow` na resposta 404, sem canonical fictícia e sem JSON-LD de página indexável.
- Sitemap editorial não lista `/404/`, mantendo separação de URLs válidas.
- QA do build e navegador Chromium verifica o status HTTP 404 verdadeiro da rota inexistente em mobile e desktop.

## Gates ainda abertos
A Cloudflare deve ser validada com 404 reais em ambiente de homologação, inclusive headers e regras de roteamento, antes de trocar o domínio. Isso não substitui a matriz 301 individual para URLs antigas com equivalência semântica.

Sem merge automático, produção, DNS, compras ou credenciais reais.
