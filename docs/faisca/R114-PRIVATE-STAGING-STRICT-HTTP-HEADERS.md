# Faísca R114 — auditoria estrita dos headers HTTP do staging privado

**Base:** R113 #588, HEAD `985ce9e3667b2294109f478758a51cc81cf0a11b`, 6/6 workflows concluídos com sucesso. A R95 #570 foi confirmada na SHA `91951653fca999f26595cc8113fbaff151225a89` (6/6). Ambas são PRs draft; R92 homologada pelo operador não significa que R95–R114 estejam instaladas na VPS.

## Defeito demonstrável

O smoke somente leitura `inspectFaiscaPrivateReviewUi` verificava os bytes exatos dos três assets, mas aceitava qualquer CSP contendo `default-src 'none'`. Assim, um servidor intermediário que alterasse o header para `script-src * 'unsafe-inline'; connect-src *`, removesse `X-Frame-Options: DENY`, relaxasse cache/robots ou substituísse o charset poderia manter os mesmos arquivos e receber `PRIVATE_UI_READONLY_VERIFIED`. A verificação de integridade dos arquivos não comprova a integridade de suas políticas HTTP.

## Mudança

- Manifesto de headers independentes do objeto de headers do servidor: CSP **exata** com `script-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'none'`; `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: no-referrer`; `Cache-Control: no-store, max-age=0`; `Pragma: no-cache`; `X-Robots-Tag: noindex, nofollow, noarchive`; MIME e charset exatos por asset.
- Rejeição de CORS (inclusive `Access-Control-Allow-Credentials`) e `Set-Cookie`.
- Testes reais GET em loopback da página tradicional e da conversa fictícia, mais 13 adulterações **apenas de headers**, mantendo HTML/JS/CSS sem alterações. Zero POST, zero dados reais e zero chamadas de IA.
- O smoke continua limitada a `127.0.0.1` e prazo absoluto R113. Nenhum header real de VPS foi lido.

## Gates

1. CI na HEAD exata (Node/HTTP, Chromium/axe, SEO, Portal Onepage, PHP, PostgreSQL) e revisão independente da política de headers.
2. Operador, se autorizado para homologação posterior, validar SHA da candidata por canal independente, preflight do ledger e smoke readonly já com esta versão no checkout isolado.
3. Continuam faltando homologação real R95+, identidade e autoridade empresarial no Portal, contratos/aceite/recibos e GO humano antes de atendimento público.

**NO-GO público:** preservados mascote, `main`, site estático e `publicFaiscaEnabled=false`. Sem merge, deploy, DNS, VPS, secrets, chamadas pagas, CRM/Portal operacional, leads, tickets ou cobranças.
