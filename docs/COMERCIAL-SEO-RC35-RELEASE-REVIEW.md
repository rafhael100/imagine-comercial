# Imagine Comercial SEO RC35 — Auditoria de acessibilidade e HOLD das URLs legadas

A RC35 inclui a RC34 (RC33 + cobertura axe-core e teclado F156 nas páginas de conteúdo) e a F157, que verifica em **HTTP real de loopback** o comportamento de rotas legadas antes da autorização da migração:

- Duas URLs legadas marcadas como candidatas e três em HOLD precisam retornar **HTTP 404** no Astro preview normal, sem redirecionar o navegador para home, serviço ou qualquer outra página
- A página 404 deve ser não indexável (`noindex,nofollow`), não declarar canonical, não publicar dados estruturados e oferecer navegação interna legítima
- A prova de 301 já existente no Cloudflare Workerd ocorre apenas numa cópia `dist` sob diretório temporário e com plano sintético, nunca no site publicável
- O inventário ainda mantém cinco candidatas e 18 rotas em HOLD, sem autorização para aplicar a regra em produção

Referências:
- [RC33 — quatro pipelines aprovados](https://github.com/rafhael100/imagine-comercial/pull/174)
- [F156 — axe/Playwright](https://github.com/rafhael100/imagine-comercial/pull/177)
- [F157 — 404 sem migração prematura](https://github.com/rafhael100/imagine-comercial/pull/182)

**NO-GO operacional:** os testes locais não verificam o site legado atual, a propriedade GSC do Portal, o domínio, a VPS Leaseweb, os contatos públicos ou equivalência editorial 1:1. Requerem inventário real por HTTP/crawl, aprovação da matriz de 301 por destino, validação de staging/TLS e rollback, revisão independente de segurança/DBA/LGPD, consentimento/tenant e autorização explícita do release owner. Sem merge `main`, DNS, redirects, deploy, dados privados em CI ou novos custos.
