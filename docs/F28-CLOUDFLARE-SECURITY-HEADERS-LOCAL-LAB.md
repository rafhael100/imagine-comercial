# F28 — Cabeçalhos de segurança em Workerd LOCAL (não deploy)

Data: 09/11/2026.

## Escopo
O site Comercial Astro é compilado como estático. Antes de habilitar Cloudflare em staging/prod, é necessário verificar quais cabeçalhos de segurança são compatíveis com suas páginas e integrações. A F28 implementa **apenas o laboratório local** e não adiciona `public/_headers`, `dist/_headers` nem configuração padrão de publicação.

## Perfil defensivo candidato
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

A biblioteca `src/lib/security-headers-preview.mjs` só permite os valores acima, sem extensões arbitrárias, CRLF, duplicatas ou ausência de cabeçalhos. O script `scripts/test-workers-local-migration.mjs` cria uma **cópia descartável** do build Astro, injeta o arquivo `_headers` APENAS nessa cópia e inicia Wrangler/Workerd em loopback, conferindo os quatro cabeçalhos nas **15 rotas públicas**. Testes unitários também verificam que arquivos capazes de ativar regras não aparecem no diretório do site.

## Decisões ainda não tomadas
- Não ativar HSTS (inclusive preload e includeSubDomains) sem auditoria de HTTPS de TODOS os hosts, subdomínios e política de rollback.
- Não ativar Content-Security-Policy sem inventário completo de scripts, CSS inline e integrações oficiais do Portal/CRM, além de aprovação de consentimento e testes no staging.
- Não tratar o perfil candidato como cabeçalhos produtivos: alteração de diretivas pode quebrar integrações de terceiros e incorporação em frames.
- Cabeçalhos efetivos em produção dependem de Cloudflare/Workers configurados e homologados, com verificação HTTP real e autorização do responsável.

Sem alterações em `main`, DNS, redirecionamentos reais, chaves, custos ou deploy. O objetivo é comprovar compatibilidade preliminar no Workerd local.
