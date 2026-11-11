# F16 — Revisão de migração Cloudflare Workers Static Assets

## Verificação técnica
A documentação oficial confirma que Workers Static Assets suporta regras no arquivo _redirects, com limite de 2.000 redirecionamentos estáticos e 1.000 caracteres por regra. As regras do arquivo não valem para respostas produzidas diretamente pelo código do Worker. A configuração de 404-page e auto-trailing-slash atende ao modelo Astro.

Fontes oficiais:
- https://developers.cloudflare.com/workers/static-assets/redirects/
- https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/

## Entrega
- src/lib/cloudflare-migration-preview.mjs valida a matriz legada e gera APENAS uma simulação de candidatos; preserva HOLD.
- scripts/preview-cloudflare-migration.mjs grava artifacts/migration-preview/REVIEW-ONLY-redirects.preview.txt e um JSON com o resumo. Jamais cria public/_redirects ou dist/_redirects.
- config/wrangler-static-assets-candidate.json fica fora do nome padrão e não é arquivo ativo de implantação.
- Testes verificam destinos, status simulados 301/404, segurança de URLs e limites do provedor.
- GitHub Actions arquiva só artefatos temporários de revisão, sem comando de deploy.

## Gates para liberar publicação
1. Obter inventário integral e dados autorizados do Google Search Console; verificar backlinks e URLs antigas.
2. Revisar correspondência editorial e obter autorização individual para cada regra 301 real.
3. Testar no runtime local Wrangler com uma configuração operacional e depois em staging autenticado, checando HTTP e 404.
4. Aprovar janela de migração, DNS, rollback, termos de privacidade e as páginas em inglês.

Os testes atuais simulam respostas HTTP, mas NÃO usam o runtime real de Cloudflare nem alteram o domínio. Sem merge main, compras ou implantação.
