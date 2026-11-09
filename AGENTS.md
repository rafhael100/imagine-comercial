# AGENTS — Imagine Comercial

## Objetivo e prioridade
Este repositório é o site público de aquisição da Imagine (P0). Tecnologia aprovada: **Astro 7**, estático por padrão e SSR apenas mediante avaliação de necessidade. A prioridade é SEO técnico verificável, conteúdo original, páginas comerciais e conversões que conduzam ao **Portal Imagine**; SEO Engine separado é P1.

## Autoridade e limites
- O Portal administra CMS, ofertas, preços, contratos, checkout, clientes, pagamentos, recorrência e notas fiscais; o site comercial não guarda valores ou dados financeiros sensíveis.
- Nunca publicar, efetuar merge em main, configurar DNS/HTTPS de produção, ativar gateways fiscais/financeiros, usar dados reais de clientes ou contratar serviços pagos sem aprovação específica.
- Trabalhar em branch isolada e PR draft; PRs empilhados devem preservar dependências e gates.
- Não gerar páginas doorway por cidade ou textos em escala para manipular buscas; exigir conteúdo diferenciado, evidência, intenção e revisão editorial.
- Credenciais, tokens e dados pessoais não pertencem a repositórios públicos.
- Nenhum teste offline ou build serve como prova de ranking, de tráfego ou de homologação de produção.

## Validação — código de laboratório ainda sem produção
- Node >=22.12; executar npm test e npm ci --no-audit --no-fund antes de npm run build.
- Executar node scripts/verify-dist.mjs: 15 rotas públicas, canonical/robots/OG, sitemap e página 404.
- CI usa Imagine SEO Engine em SHA revisado e falha em avisos SEO relevantes; não mudar para referência móvel.
- Executar npm run test:browser em CI com Chromium/axe; não confundir com CWV de campo.
- Executar node scripts/test-build-catalog.mjs somente após build: chaves Ed25519 efêmeras de CI, rejeição de adulteração e restauração do HTML editorial.
- Executar node scripts/prepare-release-review.mjs somente após build: relatório SHA-256 REVIEW-ONLY fora do diretório dist.
- Laboratório Cloudflare Workerd é apenas loopback, usa regras 301 simuladas e diretório temporário; nenhuma regra para produção.
- F24: o verificador signed-build-review confere assinatura, pins e conteúdo HTML real; o relatório NÃO autoriza deploy, não verifica grants e não comprova MFA.
- F25: quando o build for destinado a testar publicação assinada, definir IMAGINE_CATALOG_REQUIRE_SIGNED=1; nunca permitir fallback editorial nesse cenário. O indicador sozinho não autoriza deploy e não pode vir de solicitação do cliente.
- F26: auditor GSC CSV exclusivamente local/sintético; executar `node scripts/review-gsc-inventory.mjs --synthetic` no CI. CSV REAL GSC contém dados potencialmente sensíveis e NÃO deve ser enviado ao GitHub público nem a artifacts; usar `--file` apenas em ambiente privado. A saída não autoriza nem cria redirects 301.
- Antes da migração, tratar todas as URLs não catalogadas, variants com query/encoding e conteúdo jurídico em HOLD; exigir GSC real, crawl e revisão por URL.
- CI F25 Comercial: https://github.com/rafhael100/imagine-comercial/actions/runs/42657373288 (99/99 testes, SEO 35/35). Portal PHP→Astro: https://github.com/rafhael100/imagine-portal/actions/runs/42657709386 (assinatura real do fixture PHP, falha fechada testada).
- Evidências atuais: Comercial CI F24 #42644178104 (96/96 Node e 35/35 SEO); Portal PHP→Astro #42644779243 aprovado com dados sintéticos.
- Nenhum teste de laboratório prova ranking, tráfego, indexação Google ou checkout/fiscal real.

## Estrutura
- src/data/services.mjs e src/data/articles.mjs: catálogo editorial provisório, SEM preços oficiais.
- src/pages/servicos/[slug].astro e src/pages/conteudos/[slug].astro: páginas indexáveis curadas.
- src/lib/published-catalog.mjs e verify-signed-catalog.mjs: esquema público e assinatura; não autorizam emissor.
- src/lib/build-catalog.mjs e release-pin.mjs: atualização somente de metadados permitidos, com releaseId e SHA-256 obrigatórios.
- src/lib/signed-build-review.mjs: prova sintética de correspondência assinatura → HTML → hash do pacote, não recibo de entrega.
- src/lib/release-review.mjs: relatório SHA-256 do build, SEM assinatura operacional.
- src/lib/seo-output-contract.mjs: canonical, robots, sitemap e Open Graph coerentes.
- src/lib/publication-sequence.mjs: ordenação sintética, sem transação real.
- src/data/legacy-urls.mjs e src/lib/redirect-plan.mjs: inventário parcial e dry-run, sem redirects ativos.
- STATUS-ATUAL.md: consultar seção cronológica mais recente; seções antigas servem para histórico e podem conter passos já concluídos.

## Próximas tarefas prioritárias
1. Revisar a cadeia completa de PRs draft antes de qualquer integração na main; não presumir que passar no CI equivale a autorização de merge.
2. Coordenar com Portal a autenticação/MFA/grants reais, revogação, outbox idempotente e recibo do destino. Não copiar permissões sintéticas para produção.
3. Auditoria completa do domínio atual usando GSC e crawl; homologar redirecionamentos 1:1 individualmente.
4. Revisão editorial, identidade visual, licenças, portfólio, termos e política de privacidade.
5. Staging privado homologado, testes de segurança, CWV reais, checkout/contratos/fiscal; dependerá de autorização para infraestrutura e publicação.
6. Somente após decisão humana explícita: merge main, DNS, Cloudflare e produção.
