# F7 — Refinamento comercial da homepage

## Evidência
A primeira auditoria de capturas reais foi feita usando artefato do PR #8, obtido em execução Chromium. O design inicial apresentou muito espaço sem conteúdo visual à direita do destaque principal e poucos sinais sobre a proposta de valor.

## Refinamentos implementados
- Hero de duas colunas com ilustração **original em HTML/CSS**, independente de imagens externas ou dados fictícios de clientes.
- CTA primário 'Solicitar uma proposta', e secundário 'Conhecer os serviços', ambos apontando para rotas funcionais existentes.
- Benefícios de processo descritos sem métricas inventadas.
- Links para todos os seis serviços a partir da home, com reforço de interligação interna.
- Design responsivo e sem dependência de JS; manter HTML rastreável.
- Elemento visual é decorativo, com `aria-hidden`, sem interferir no conteúdo acessível.

## Limites
O logo oficial, identidade visual definitiva, portfólio com autorização e identidade de campanhas ainda devem ser homologados. Não usar capturas de telas de clientes sem consentimento. Nenhum preço, ranking, resultado ou avaliação fictícia foi inserido.

## Testes
Build Astro, HTML, auditor SEO independente, Playwright 375px/1440px, axe WCAG 2.1 A/AA e capturas devem passar antes de publicar o PR.
