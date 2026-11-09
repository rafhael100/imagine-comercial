# F2 — Contrato de catálogo publicado (proposta técnica)

## Objetivo
Preparar o Imagine Comercial para receber **somente conteúdo publicável** do Portal Imagine, sem armazenar dados de clientes, preços internos, tokens, chaves, assinaturas ou checkout no site público.

## Modelo sintético versão 1.0
- `schemaVersion`: versão de contrato (atualmente `1.0`).
- `releaseId`: identificador único do lote aprovado.
- `publishedAt`: data ISO-8601 UTC, preservada para auditoria.
- `items[]`: serviço com `id`, `slug`, `title`, `description`, `path`, `status=published`, `version`, `offerRef` opcional.

Arquivo `src/lib/published-catalog.mjs` contém validador **offline**, testado com dados sintéticos, não integrado ao Portal. Campos extras são rejeitados, incluindo dados privados e preços não autorizados; texto tratado como texto simples sem HTML. O site ainda usa `src/data/services.mjs` como fonte editorial manual inicial.

## Fluxo futuro (não implementado)
1. Backoffice salva rascunho e possui revisão/autorização editorial.
2. Portal gera snapshot público mínimo, assinado e versionado; publicador valida origem/autenticidade no servidor e aplica catálogo somente após aceite.
3. Astro compila conteúdo publicado e gera preview privado protegido (sem indexação).
4. Publicação verifica rotas, canonical, schema, sitemap, integridade da oferta e redirecionamentos.
5. Mudanças são aplicadas com identificador de versão, preservando snapshot anterior para rollback e controle de concorrência.
6. CTA envia referência opaca ao checkout do Portal; o backend valida preço real, descontos, vigência e condições no momento da compra.
7. Falha de publicação preserva a última versão estável; alertas reportam discrepância entre oferta e apresentação.

## Limites de segurança
- O validador de snapshot **não autentica ou autoriza** o emissor e não pode ser usado isoladamente na borda como mecanismo de segurança.
- Implementar autenticação service-to-service, proteção anti-replay, escopo/tenant, assinatura, validação de schema no Portal, rate limiting, auditoria e observabilidade antes de consumo real.
- Não transmitir segredos, dados fiscais internos, clientes, pedidos, valores de cartão ou nomes de usuários.
- Publicar somente serviços homologados; `status != published` é rejeitado.
- Integração de preços publicados requer contrato próprio, sempre com autoridade final do checkout.
- Alteração de slug requer matriz de 301/308 e revisão SEO.
- Esta fase não exige integração com o banco do Portal, nem autoriza conexão real.

**Sem merge em main, sem produção ou deploy.** Referência: https://github.com/rafhael100/imagine-comercial/issues/4
