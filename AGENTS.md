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
- F27: cruzamento GSC × crawler apenas em dados sintéticos no CI; comparar por host/path sem unificar variantes com query omitida. Não aprovar 301 automaticamente.
- F28: perfil de segurança HTTP só existe como `_headers` em cópia temporária do Workerd local; nunca criar `public/_headers` ou `dist/_headers` em PR de revisão.
- F29: link Portal apenas de build confiável, hosts HTTPS exatos e sem query/fragmento/credenciais; `resolvePortalLoginLink` retorna vazio e oculta link inválido. Não ampliar allowlist sem revisão.
- F30: `lead-intake-lab.mjs` é apenas contrato sintético sem rede, dados reais ou gravação durável. Consentimento booleano em teste NÃO prova cumprimento LGPD.
- F31: páginas Astro públicas não devem importar o mock F30 nem enviar dados pessoais. Testes Node/Chromium verificam ausência de formulário, POST, cookies, storage e requests externos enquanto API/privacidade não forem aprovados.
- F32: `reviewPublicLinks` no browser QA valida **todos** os links HTML contra rotas exatas, fragmentos, serviço no contato e canais externos allowlisted. `/404/` só é permitido para skip-link local, não sitemap. Não ampliar URLs sem revisão.
- F33: uma exceção de link Portal só pode corresponder **exatamente** à URL HTTPS de login validada por `resolvePortalLoginLink` e configurada no build. O link permanece oculto por padrão; login real/MFA/grants dependem do Portal homologado.
- F34: evidência observada do site legado em `src/data/legacy-public-evidence.mjs` é dado público com data e **não equivale** a GSC, HTTP vivo, backlinks ou autorização de redirect; Meta permanece candidate, Mercado Livre HOLD.
- F35: três workflows de CI usam checkout/setup-node/upload-artifact v7 **pinadas por SHA completo**, conferidas por `tests/ci-immutable-actions.test.mjs`. O runtime das Actions é Node 24; `node-version: '22'` continua para Astro. Proibido reintroduzir tags mutáveis, `pull_request_target`, id-token de deploy ou persistência de credenciais.
- F36: telefone, email e WhatsApp públicos são definidos exclusivamente em `src/data/contact-channels.mjs`, usado pela página Contato e auditor F32. Nenhum valor duplicado/novo deve ser publicado sem revisão de evidência e confirmação operacional. Builders `contactWhatsAppUrl` e `contactEmailUrl` não transmitem dados automaticamente.
- F37: `IMAGINE_RELEASE_TARGET=staging|production` requer `IMAGINE_CATALOG_REQUIRE_SIGNED=1` e envelope Ed25519 pinado; não aceitar fallback editorial no pipeline protegido. `npm run build:protected` SEMPRE apaga `dist/` e prova anterior antes de validar entradas; executá-lo somente em workspace descartável com entradas confiáveis, não em diretório de trabalho compartilhado. O resultado `PROTECTED-BUILD-REVIEW-ONLY.json` não autoriza deploy e não substitui MFA/grants/receipt externo. [CI F37 #42715227623](https://github.com/rafhael100/imagine-comercial/actions/runs/42715227623) — 165/165 Comercial + 35/35 SEO, Astro e browser.
- F38: `npm run verify:protected` exige **árvore SHA-256 esperada de canal confiável independente**, releaseId/keyId/digest pinados, envelope Ed25519 e relatório completo da F37; falha em qualquer adulteração de HTML, árvore ou manifesto. É verificação OFFLINE e não autorização de deploy; proibir usar hash extraído do próprio pacote como pin de confiança. [CI #42719002974](https://github.com/rafhael100/imagine-comercial/actions/runs/42719002974) — 170/170 Comercial + 35/35 SEO.

- CI F36 [#42701263239](https://github.com/rafhael100/imagine-comercial/actions/runs/42701263239): 159/159 Comercial, 35/35 SEO e browser aprovados; CI é local e não certifica canais em operação nem prontidão de produção.
- Evidências: [F34 CI #42691968228](https://github.com/rafhael100/imagine-comercial/actions/runs/42691968228) — 152/152 + 35/35; [F35 CI #42699357424](https://github.com/rafhael100/imagine-comercial/actions/runs/42699357424) — 154/154 + 35/35; [Workerd v7 #42699357426](https://github.com/rafhael100/imagine-comercial/actions/runs/42699357426) e [Lighthouse v7 #42699357115](https://github.com/rafhael100/imagine-comercial/actions/runs/42699357115) aprovados. Testes locais não certificam produção.

- Evidência atual: [CI integrado F0-F32](https://github.com/rafhael100/imagine-comercial/actions/runs/42689734469) + [Workerd](https://github.com/rafhael100/imagine-comercial/actions/runs/42689734707) + [Lighthouse local](https://github.com/rafhael100/imagine-comercial/actions/runs/42689734662); [CI F33](https://github.com/rafhael100/imagine-comercial/actions/runs/42690443110) com 149/149 Comercial e 35/35 SEO. Nunca confundir CI com publicação.

- CI atual acumulado: [F31 #42679446452](https://github.com/rafhael100/imagine-comercial/actions/runs/42679446452) — 138/138 Comercial + 35/35 SEO e browser; integração prévia F0-F30 com [CI geral](https://github.com/rafhael100/imagine-comercial/actions/runs/42679033130), [Workerd](https://github.com/rafhael100/imagine-comercial/actions/runs/42679033209) e [Lighthouse local](https://github.com/rafhael100/imagine-comercial/actions/runs/42679033372) verdes.

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

## Continuidade F39–F50 — limites de segurança (10/11/2026)
- F39–F48: recibos Ed25519, witness, política de raiz, anti-replay e correlação de pacote Astro verificam **somente dados de laboratório**; nunca usar identificadores sintéticos, root keys ou tokens de CI para conceder permissão de publicação.
- F49: `src/lib/postgres-witness-replay-ledger.mjs` é adaptador para cliente PostgreSQL **injetado**. O índice `(witness_key_id, nonce)` da migração proposta é indispensável à unicidade; **não aplicar automaticamente** `db/migrations/001-witness-replay-nonce.sql`. Validar transações, papel restrito, fail-closed, backups e retenção em banco real antes de produção.
- F50: o E2E de build Astro assinado usa o código do adaptador F49 mas um transporte `query` simulado; os testes NÃO exercem PostgreSQL real. Gate de homologação privado em [issue #56](https://github.com/rafhael100/imagine-comercial/issues/56).
- A `main` ainda é documental, e `integration/comercial-p0-f33-review-2026-11-09` permanece branch **DRAFT / REVIEW ONLY**. Novas alterações entram em branches isoladas e PRs draft. Nenhum CI equivale a autorização de deploy, DNS ou migração da produção.
