# F172 — Paridade de escopo comercial entre site legado e Imagine Comercial

## Fontes públicas observadas em 11/11/2026

- https://www.imaginecomunicacao.com.br/ — vitrine atual com “MAIS SERVIÇOS PARA VOCÊ”, inclusive anúncios Facebook/Instagram.
- https://www.imaginecomunicacao.com.br/clientes.html — lista pública de categorias comerciais no rodapé.

Este inventário de **14 títulos públicos identificados nessas duas fontes** não é uma afirmação de que cada serviço continua à venda, de que os nomes são atualizados, nem que represente todos os serviços da empresa. A validação independente do responsável é obrigatória antes de reescrever a oferta, retirar serviços ou ativar redirects.

O código `src/data/legacy-public-offerings.mjs` descreve os títulos públicos em dois estados deliberadamente restritos:

- **4 candidatos de correspondência** (`CANDIDATE_REVIEW_NOT_EQUIVALENT`): criação de sites, Landing Pages, Google Ads e anúncios Facebook/Instagram. A existência de um slug parecido no novo catálogo **não** comprova equivalência de oferta, preço, modalidade, entrega, contrato ou redirecionamento.
- **10 categorias antigas sem correspondência aprovada** (`HOLD_UNMAPPED`), incluindo loja virtual, sistemas personalizados, aplicativos, gestão de redes sociais, serviços Marketplace, YouTube, LinkedIn e identidades sociais. Essas categorias precisam de decisão explícita: manter, descontinuar com comunicação apropriada, consolidar ou reconstruir páginas.
- **2 slugs novos sem título correspondente nesse recorte legado**: Onepage e Sites por assinatura. Exigem revisão própria de conteúdo/preço/contrato antes de lançamento, não aprovação automática.

O comando offline `node scripts/report-launch-blockers.mjs` inclui agora `legacyPublicServiceScope` com contagens e itens pendentes. Sempre retorna `contentScopeOwnerApproved=false`, `legacyToNewEquivalenceVerified=false`, `seoRedirectsAuthorized=false` e `deploymentAuthorized=false`, independentemente da quantidade de testes. A F42 continua bloqueando explicitamente `content-brand-contacts-pricing` e `gsc-real-crawl-and-redirect-review`.

**Separação fundamental:** títulos de serviço são uma dimensão editorial/comercial; as **23 URLs legadas** de F162 são outra dimensão técnica/SEO. Um mapeamento editorial não cria um 301, e o status 301 candidato em laboratório não representa liberação do negócio. O controle de 404/noindex continua preservado.

Sem dados pessoais, crawl real executado pela CI, GSC privado, novos serviços prometidos publicamente, edição de produção, merge main, DNS, compra ou deploy. O operador precisa obter decisão de produto e revisão legal/comercial antes de publicar uma substituição.
