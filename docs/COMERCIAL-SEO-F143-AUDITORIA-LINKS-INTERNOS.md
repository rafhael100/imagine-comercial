# Comercial SEO-F143 — Auditoria de links internos no HTML compilado

O comando `scripts/verify-dist.mjs` valida agora cada link `<a href>` das páginas Astro geradas. Caminhos internos precisam existir exatamente no catálogo público de páginas (`sitePages`), com barras finais normalizadas. A verificação não resolve nem consulta endereços pela rede; links externos continuam limitados a esquemas permitidos (HTTPS, `mailto:` e `tel:`). São recusados links relativos ambíguos, URLs com parâmetros internos, encoding perigoso, rota inexistente e esquemas executáveis (`javascript:` ou `data:`).

Fragmentos preservam a navegação pública existente, inclusive links com intenção de atendimento (`/contato/#landing-pages`) cujo tratamento é controlado pela página de contato; o teste do navegador continua verificando o fluxo. Testes F143 executam casos negativos sem imprimir URLs privadas em erros.

É uma proteção de **build e navegação do site**, não um scanner de websites externos ou um comprovante de publicação. Permanece em branch de revisão, sem deploy, merge na `main`, DNS, redirects 301 ou dados de visitantes.
