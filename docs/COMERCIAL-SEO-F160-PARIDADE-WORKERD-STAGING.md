# Comercial SEO-F160 — Paridade HTTP entre Workerd local e futuro staging privado

O laboratório Cloudflare Workerd já executava a aplicação Astro em `127.0.0.1:8798` com assets, regras `_redirects` de simulação e `_headers` revisados F28, tudo em diretório temporário. A F160 executa **o mesmo diagnóstico passivo F159** nesse servidor real, antes dos demais testes de navegação.

O F159 exige quatro páginas públicas HTTP 200 com canonical, robots e cabeçalhos de segurança corretos; 18 URLs legadas HOLD precisam responder 404 com noindex, sem canonical ou JSON-LD. Isso detecta diferenças entre o contrato de staging e o runtime Cloudflare em vez de depender apenas de objetos sintéticos. A integração mantém as verificações existentes de 301 simulados (somente cinco candidatos dentro da cópia temporária), status de todas as páginas, sitemap e robots.

O workflow Workerd passa a reagir também a alterações do verificador F159. Nada é publicado: Wrangler roda apenas em `--local --ip 127.0.0.1`, `WRANGLER_SEND_METRICS=false`, sem conta, token, DNS ou deploy. Ao terminar, o diretório temporário é eliminado.

**NO-GO de produção:** CI Workerd é evidência de compatibilidade técnica local; staging privado real, segurança independente, controles Portal/CRM, migração SEO aprovada e plano de rollback continuam requisitos.
