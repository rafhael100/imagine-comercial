> **F230 — Dois ambientes diferentes:** o campo `futurePublicEdgeChecklistEntries` conta casos de simulação de comportamento futuro do domínio público; `realStagingHttpVerified:false` continua independente. O Nginx privado da Leaseweb permanece noindex/Basic Auth e não deve ser avaliado com a matriz de redirects públicos.
# F229 — Bloqueios de lançamento incluem política de host e matriz de rotas

O comando `node scripts/report-launch-blockers.mjs --target=staging` (ou `--target=production`) agora inclui um resumo **estático e offline** de:

- domínio canônico raiz sem `www` decidido na F225;
- quantas rotas públicas fazem parte do catálogo Astro;
- 5 URLs legadas candidatas, ainda sem redirect autorizado, e 22 em HOLD;
- total de verificações da matriz F227 (todas as rotas × quatro origens);
- verificação real de staging, migração SEO por URL, DNS, redirects e go-live: **não autorizados/não comprovados**.

Nenhuma métrica Google, credencial, registro HTTP privado, host interno da VPS ou dado de cliente aparece no relatório. O documento serve para evitar que a aprovação da escolha do host seja confundida com autorização de ativação DNS, 301, ou deploy.

Prosseguir só com staging privado real, SEO/crawl/GSC/backlinks, revisão legal/AppSec, integração Portal/CRM, e aprovação formal de publicação.
