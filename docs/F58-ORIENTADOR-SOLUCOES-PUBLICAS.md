# F58 — Orientador de soluções públicas (sem lead ou rastreamento)

Na página `/servicos/`, um seletor permite escolher um **objetivo comercial geral** e mostra links para soluções já existentes, sem criar preços, descontos, planos, propostas ou critérios de elegibilidade. As cinco opções são fixas e cobrem as seis páginas já publicadas no catálogo do build Astro: Onepage, site multipágina, Landing Page, sites por assinatura e gestão Google/Meta Ads.

## Proteções
- O mapa de objetivos e as URLs resultantes vêm apenas da allowlist `src/lib/public-service-guide.mjs`. Valores não permitidos falham sem refletir a entrada.
- A atualização é feita por `textContent` e criação de elementos HTML com URLs locais; não usa `innerHTML`, cookies, armazenamento, formulário, API, analytics nem envio de contatos.
- Com JavaScript desativado, a lista normal de todos os serviços continua visível e navegável.
- A explicação é **orientativa**: não substitui briefing, orçamento, proposta, preços ou as aprovações comerciais no Portal.
- Os testes Node verificam whitelist, cobertura completa das seis rotas e fronteiras negativas; Playwright valida escolhas, links, responsividade, acessibilidade e ausência de pedidos externos.

Nenhum serviço depende de autenticação. Nenhuma publicação em domínio, integração de CRM/Portal ou migração de VPS ocorre neste recorte.
