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
| `GET/HEAD` nas outras 62 páginas Astro explícitas | **Novo site estático**, somente em origem isolada revisada |
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
