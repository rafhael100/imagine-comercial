# STATUS-ATUAL — Imagine Comercial
Data de referência: 09/11/2026, horário de Brasília.

## Decisão
Astro 7 SEO-first; projeto independente do Portal e do SEO Engine. Site atual `imaginecomunicacao.com.br` NÃO substituído.

## PRs de desenvolvimento
- PR #1 F0: fundação Astro — https://github.com/rafhael100/imagine-comercial/pull/1
- PR #2 F1: seis páginas de serviço, homepage e contato — https://github.com/rafhael100/imagine-comercial/pull/2
- PR #5 F2: contrato offline de conteúdo público e auditor de SEO fixado no CI — https://github.com/rafhael100/imagine-comercial/pull/5
- PR #6 F3: inventário parcial legado e redirecionamentos **não ativos** — https://github.com/rafhael100/imagine-comercial/pull/6
- PR #7 F4/F5: quatro artigos, hub editorial, guardas de versionamento — https://github.com/rafhael100/imagine-comercial/pull/7

## Validação mais recente
- Última execução aprovada antes da atualização documental: https://github.com/rafhael100/imagine-comercial/actions/runs/42559456590
- 35/35 testes Node aprovados; build Astro passou.
- 15 páginas HTML geradas, sitemap e robots verificados.
- Auditor independente SEO Engine: 15 páginas, **0 erros**, **0 avisos** relativos às regras implementadas.
- Não houve teste de Search Console real, browser, CWV de campo, CAPTCHA, lead CRM, pagamento ou fiscal.

## Gates
- Branches e PRs em draft; nenhuma main alterada por estes recortes, sem deploy ou modificação de DNS/produção.
- Portal CMS/checkout e conexão real com SEO Engine ainda não habilitados.
- Conteúdo editorial e dados de contato requerem revisão final antes da publicação.
- O domínio legado tem páginas `www`, `.html`, `en-us` e clientes; inventário/redirects completos exigem Google Search Console e revisão de conteúdo.
- `package-lock.json` ainda pendente; CI usa `npm install`, não build completamente reprodutível.

## Próximo recorte recomendado
Auditoria SEO da migração e estabilização de dependências/preview protegido, seguida de contrato de publicação autenticada com Portal e QA responsivo.
