# Imagine Comercial — F314: transição segura por sobreposição, preservando o site antigo

**Objetivo:** permitir uma futura homologação privada das novas páginas Astro
sem derrubar páginas jurídicas, formulários e URLs históricas do site atual.

A proposta só classifica o destino de uma requisição; não cria proxy, Worker,
301, configuração DNS, imagem Docker, segredo ou deploy. **O site
original continua sendo a origem de referência.**

## Estratégia de migração

Enquanto o backend Portal/CRM e o legado não estiverem formalmente
homologados, uma candidata de *roteamento privado* poderá ser avaliada com
regras conservadoras:

| Tipo de solicitação | Direção prevista |
|---|---|
| `GET/HEAD /` (home pública histórica) | **Legado**, preserva formulário que hoje aparece na home |
| `GET/HEAD /contato` e `/contato/` | **Legado**, sem presumir equivalência do formulário |
| `GET/HEAD` nos 81 caminhos do sitemap legado e variantes com barra | **Legado**; uma entrada malformada excluída |
| `GET/HEAD` nas outras **61** páginas Astro explícitas | **Novo site estático**, somente em origem isolada revisada |
| `GET/HEAD` para os 27 caminhos legados conhecidos | **Legado**, incluindo 22 HOLD e 5 candidatas a 301 não autorizadas |
| `GET/HEAD /robots.txt` e `/sitemap.xml` | **Legado**, não substituir índice antigo às cegas |
| `GET/HEAD` para `/_astro/...` presentes no manifesto SHA-256 e `/logo-imagine.png` | **Novo estático**, somente arquivos revisados |
| `GET/HEAD` para quaisquer outros caminhos (inclusive legado ainda não inventariado) | **Legado**, por padrão |
| `POST/PUT/PATCH/DELETE/OPTIONS` em qualquer URL | **Legado**, para não silenciar captação, APIs e submits históricos |

A classificação é uma **proposta** e não implica que um proxy real deva
encaminhar todos os métodos: o operador ainda deverá revisar limites, cookies,
CSRF, CORS, cabeçalhos, tamanho de corpo, segurança, disponibilidade e
responsabilidades de tratamento de dados do backend original.

O programa `src/lib/progressive-legacy-overlay-plan.mjs` produz apenas
decisões simbólicas `REVIEWED_NEW_ASTRO_HTML`,
`REVIEWED_NEW_ASTRO_ASSET` ou `LEGACY_ORIGIN_RETAIN`. Nenhum endereço
real de origem é inserido em código, PR, log ou artifact. O script de CI
`scripts/prepare-progressive-legacy-overlay-ci.mjs` verifica o manifest
SHA-256 e os recursos usados pelos 63 HTML e registra um relatório
`REVIEW-ONLY-progressive-legacy-overlay.json`.

## Limitações de SEO

A sobreposição preserva a home antiga, porém as traduções `/en/` e
`/es/` do Astro referenciam o português `/` em `hreflang`. A home
antiga **não** fornece necessariamente o par recíproco e pode conter
metadados diferentes. Além disso, robots e sitemap continuam antigos.

**Logo, essa topologia é adequada apenas para homologação privada,
autenticada e com `noindex` forçado por cabeçalho em TODAS as rotas
experimentais. Não é um estado publicável/SEO aprovado.**

Antes de um lançamento público exigir:
1. Comprovação independente de que a origem legada ainda serve o site e
   recebe os formulários existentes, com backup e teste de restauração;
2. Inventário de conflitos por URL e do conteúdo legado que não está nas
   27 rotas; revisão jurídica editorial da política de dados e de retenção;
3. Servidor de legado separado com TLS e hostname/origem dedicados, sem
   loop de DNS, sem misturar credenciais, cookies ou tráfego sensível,
   verificado por equipe de infraestrutura;
4. Verificação HTTP real do roteador, incluindo solicitações POST de
   ponta a ponta em ambiente autorizado com dados de teste e consentimento;
5. Plano SEO definitivo: conteúdo recíproco PT/EN/ES, `hreflang`,
   canonical, sitemap consolidado ou transição indexada e redirecionamentos
   individualmente aprovados (não emitir 301 automático);
6. Atribuição de responsável por rollback, backups protegidos, monitoramento
   de erros 404/5xx, relatórios de leads recebidos e janela de publicação;
7. Confirmação do catálogo comercial assinado no Portal e das regras de
   ativação e gestão antes de ativar qualquer contratação ou gateway.

## Reversão

Para uma eventual operação autorizada, documentar a troca de roteamento
reversível para o **servidor histórico**. A reversão só pode ser declarada
realizada após verificar DNS/TLS, 200 nas páginas originais, funcionamento
do formulário antigo em ambiente seguro e ausência de mudança de dados.
Não prometer rollback automático sem um ensaio registrado.

## Status

**DRAFT / REVIEW-ONLY / NO-MERGE / NO-DEPLOY / NO-REDIRECT /
NO-LEAD-COLLECTION / NO-CHARGE.** Nenhum teste nesta PR é prova de acesso
à Leaseweb, Cloudflare, GSC, DNS, domínio original ou CRM de clientes.

## F314 — inventário público ampliado (19/11/2026)

O sitemap histórico observado em 18/11/2026 contém 82 loc: **81 URLs HTTP
www válidas pertencentes ao domínio** e um hostname duplicado malformado
excluído. O catálogo versionado de 81 caminhos e hashes do XML e caminhos
está em `src/data/legacy-public-sitemap-paths.mjs`; não contém dados GSC,
HTML, cookies, cabeçalhos, formulários ou informações de clientes.

A proteção contempla também os caminhos com barra final, somando **161 variantes
únicas**. Entre as 63 rotas compiladas do Astro, o cruzamento encontrou duas
que devem permanecer no legado: a home `/` e `/contato/`, cuja variante
sem barra `/contato` consta do sitemap antigo. A prévia conservadora admite
**61 páginas novas**, enquanto o build do site permanece com 63 páginas.

O teste HTTP F317 verifica que as 161 variantes continuam servidas pela
origem legada **sintética em loopback**, além das 27 rotas F310. Este ensaio
não comprova HTTP 200 real, formulário, equivalência de conteúdo, redirects,
backups ou funcionamento na VPS. O `/contato` real foi observado com 302,
mas seu destino funcional não foi homologado. O sitemap público antigo não é
substituído; nenhuma regra 301, DNS, checkout ou deploy é ativada.

## F358 — protocolo de formulários históricos (19/11/2026)

O ensaio HTTP local verifica seis rotas representativas de contato, incluindo
`/component/imaginecontato`, `/fale-conosco`, `/contato` e `/contato/`.
Ele deve encaminhar **POST, querystring, cookie de sessão, Content-Type e
corpo byte-idêntico**, inclusive `multipart/form-data` com boundary, ao
servidor legado **sintético**. Também testa métodos mutantes nas 161 variantes
do sitemap e evita que atinjam o Astro.

É um teste de preservação de encaminhamento, não de entrega real de leads,
consentimento, CSRF do Joomla/Portal, funcionamento do SMTP ou recebimento
pelo CRM. Não executa POST no domínio público nem na VPS; a prova real de
captação e rollback permanece bloqueada na issue P0 #466.

## F359 — matriz pública de continuidade (19/11/2026)

A CI passa a produzir `REVIEW-ONLY-public-sitemap-continuity.json`, no
mesmo artifact de revisão de release existente. Cada uma das **81 linhas**
lista somente pathname do sitemap público e a variante com barra, informa se
existe colisão com a lista Astro ou com o inventário F310 e mantém ambas as
decisões como `LEGACY_ORIGIN_RETAIN`.

Uma colisão é exata (`/`) e uma depende da barra final
(`/contato` → `/contato/`). A matriz não contém GSC, métricas, HTML,
conteúdo de visitantes, credenciais, novos links autorizados ou POSTs.
**Nenhum HTTP é executado para gerar o arquivo**; não há verificação de
status atual, equivalência editorial, entrega de formulário ou rollback.
As linhas são para revisão por SEO, conteúdo, jurídico e infraestrutura, não
para alimentar automaticamente `_redirects` ou produção.
