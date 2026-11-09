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

## Validação
- `npm test` (Node 22+): contratos e testes sintéticos.
- `npm install --no-audit --no-fund && npm run build` (ambiente autorizado).
- `node scripts/verify-dist.mjs`.
- CI revisa auditor SEO externo por commit fixo no workflow, com relatório de erros e avisos do HTML compilado.
- Não alegar Lighthouse/CWV, acessibilidade no navegador ou teste de checkout executados quando não foram.

## Estrutura
- `src/data/services.mjs` e `src/data/articles.mjs`: catálogo/editorial *temporário*, não preços oficiais.
- `src/pages/servicos/[slug].astro`, `src/pages/conteudos/[slug].astro`: páginas indexáveis curadas.
- `src/lib/published-catalog.mjs`: valida snapshots públicos offline, não autoriza emissor.
- `src/lib/publication-sequence.mjs`: protege ordem de publicação em simulação.
- `src/data/legacy-urls.mjs` e `src/lib/redirect-plan.mjs`: inventário parcial e **modo dry-run**, sem redirecionamentos reais.

## Próximas tarefas prioritárias
1. Auditoria integral do domínio atual e migração 1:1 antes de trocar URLs.
2. Revisão comercial e editorial, imagens originais autorizadas, portfólio e política de privacidade.
3. Testes reais em navegador mobile/desktop, acessibilidade, CWV e proteção staging.
4. Gerar lockfile, determinar build reprodutível e governança de dependências.
5. Contratos Portal CMS e checkout em ambiente isolado, com autenticação e gates.
6. Homologação do lançamento apenas após decisão humana exclusiva.
