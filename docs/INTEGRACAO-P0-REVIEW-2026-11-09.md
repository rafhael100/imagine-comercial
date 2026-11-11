# Integração P0 do Imagine Comercial — candidato exclusivo de revisão

Referência: 09/11/2026. **Não é release e não autoriza merge em main.**

## Por que existe esta branch
O desenvolvimento F0–F25 foi organizado em PRs draft empilhados e implementa partes complementares no mesmo histórico. A comparação main → F25 mostrou 77 commits à frente e 0 atrás, com 91 arquivos alterados antes deste documento. Esta branch de integração aponta para o conjunto acumulado para revisão e CI único. Não substitui as revisões de cada recorte e não altera o domínio publicado.

## Escopo de código para revisão
- Site Astro 7 estático, conteúdo curado: homepage, 6 soluções, contato, sobre e 4 artigos, total 15 rotas públicas.
- SEO técnico, sitemap, canonical/OG, página 404 real, desempenho e acessibilidade sintéticos em navegador.
- Motor SEO independente fixado em commit 238acb0772dc7597f23ce3fd1761d68be1d35179 no workflow.
- Catálogo público assinado Ed25519 em build com releaseId e digest, ligado ao HTML/árvore SHA-256 em laboratório.
- F25: modo de catálogo assinado obrigatório com falha fechada, inclusive se todos os inputs sumirem.
- Migração SEO do site antigo apenas em inventário parcial e simulação; nenhuma regra _redirects publicada.
- GitHub Actions e Workerd local são ensaios, não infraestrutura produtiva.

## Evidências anteriores à integração
- Comercial F25: https://github.com/rafhael100/imagine-comercial/actions/runs/42657373288 — 99 testes Node Comercial e 35 SEO Engine aprovados, Astro e QA navegador.
- Portal PHP → PostgreSQL 18 → Astro F25: https://github.com/rafhael100/imagine-portal/actions/runs/42657709386 — verificação de assinatura sintética, HTML, hash e recusa de fallback.
- Workerd F23: https://github.com/rafhael100/imagine-comercial/actions/runs/42630802163 — 15 páginas HTTP 200, 5 redirecionamentos SIMULADOS, 11 HTTP 404.
- O CI desta branch de integração é uma validação adicional obrigatória, não herdada automaticamente das execuções anteriores.

## Gates de lançamento — todos devem permanecer ABERTOS
| Gate | Critério necessário | Evidência ainda faltante |
|---|---|---|
| G01 — identidade e autoridade | sessão Portal real, MFA, permissão específica e grants frescos | integração autenticada e teste independente com revogação |
| G02 — operação de publicação | publicador de privilégios mínimos, ledger/outbox durável, idempotência no destino, recibo e reconciliação de falhas | staging isolado com consumidor real e rollback |
| G03 — conteúdo e integridade | aprovação expressa editorial, chaves operacionais, rotação/revogação, versão/release autorizado | revisão comercial e pipeline de confiança protegido |
| G04 — migração SEO | inventário integral GSC + crawl + destino 1:1 aprovado por URL, hosts/canonicals/redirects verificados | conta GSC autorizada, sem decisões por similaridade automática |
| G05 — legal e comercial | portfólio licenciado, identidade visual aprovada, termos/privacidade e contratos/preços oficiais | revisão humana, política jurídica e fiscal, checkout oficial no Portal |
| G06 — homologação e observabilidade | staging privado, acesso restrito, CWV em campo quando disponível, logs/alertas, testes de recuperação | VPS/contas de homologação autorizadas e execução real |
| G07 — autorização de lançamento | responsável aprova merge, DNS/Cloudflare, janela e rollback após gates anteriores | aprovação exclusiva, separada de qualquer teste CI |

## Segurança e procedimentos
- Nunca usar chaves privadas, tokens de cliente ou dados pessoais em repositório público.
- Nunca gerar _redirects real, publicar alterações em Cloudflare, ativar checkout ou alterar DNS nesta branch.
- Não fazer merge automático: conservar este PR como **draft** e identificar cada revisão e risco residual.
- Não concluir que G01–G07 passaram apenas porque Node, Astro, PHP, SQL e Workerd de laboratório ficaram verdes.
- A main deve permanecer intacta até decisão humana específica; a integração de outros desenvolvimentos paralelos do Portal deve ser revisada em branch própria antes de conectar runtime real.
