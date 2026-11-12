# F231 — Auditoria HTTP privada com cobertura completa (Leaseweb)

A revisão local F159 verificava 4 rotas públicas e 22 caminhos legados em HOLD. A F231 adiciona o modo **`fullCoverage:true`** ao mesmo verificador e o habilita por padrão no CLI HTTP autenticado. **A F232 passa a exigir essa mesma cobertura no diagnóstico único `review-private-staging-operator.mjs`**, impedindo um falso parecer completo baseado na antiga amostragem.

Com esse modo, o verificador HTTP passive usa somente `http://127.0.0.1:<porta>` de serviço preparado por operador, executa desafio HTTP 401 sem credenciais para todos os caminhos testados e então valida Basic Auth nos caminhos exatos do catálogo:

- todas as páginas atuais do Astro: HTTP 200, canonical de produção mantido no HTML; cabeçalhos do staging com `noindex`, `nofollow`, `no-store` e nenhum Set-Cookie;
- **todos os 27 caminhos históricos**, incluindo os cinco candidatos não aprovados: HTTP 404, HTML com meta noindex/nofollow, nenhum canonical nem JSON-LD, sem redirects;
- `robots.txt`, `sitemap.xml` e asset sentinel também precisam negar acesso a visitantes sem autenticação.

O comportamento privado Leaseweb difere deliberadamente do **futuro site público**: não há redirect de host e o staging é integralmente noindex. O teste público futuro do F227/F228 não substitui este HTTP real. O modo reduzido sem `fullCoverage` permanece para compatibilidade com testes Workerd isolados.

**Operação futura:** seguindo `ops/staging/README.md`, após instalação privada pelo operador e SSH/túnel, usar `IMAGINE_PRIVATE_STAGING_REVIEW=1 node scripts/review-private-staging-http.mjs --port=4321` com senha somente no ambiente autorizado. O código não sobe contêiner, não acessa rede externa, não altera DNS nem autoriza publicação. Testes CI simulam respostas e não comprovam Leaseweb real.
