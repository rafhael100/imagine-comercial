# Comercial SEO — Candidata de atualização RC36 do auditor pinado

**Objetivo:** validar em PR draft a atualização do auditor SEO do Imagine Comercial para a RC36 completa, sem modificar produção.

## Referências imutáveis

- SHA F81 da revisão anterior (candidato de rollback): `10a649f9c448fe8412da6e8c499eec0637d9259e`.
- SHA RC36 candidato: `440d515c1094ed5c8e0094c5c614fe1d6d49d881` ([SEO RC36 #124](https://github.com/rafhael100/imagine-seo-engine/pull/124)).
- [Comercial #233](https://github.com/rafhael100/imagine-comercial/pull/233) comprovou auditoria F81 versus versão anterior sobre o mesmo build.
- [Comercial #235](https://github.com/rafhael100/imagine-comercial/pull/235) comprovou auditoria RC35 versus F81, testando CSV e gate de contagem.
- [Comercial #236](https://github.com/rafhael100/imagine-comercial/pull/236) testou com dados fictícios a diferença de privacidade RC35/RC36 para CPF/CNPJ formatados.

## Escopo desta PR

- Atualizar apenas o SHA usado no checkout do motor SEO em `.github/workflows/validate.yml` e sua verificação `git rev-parse HEAD`.
- Manter os testes que exigem **SHA exato**, agora RC36, em `tests/ci-immutable-actions.test.mjs` e `tests/seo-audit-pin.test.mjs`.
- Executar todo o pipeline de site, build Astro, auditor técnico, validações de URLs, navegador e CI de banco; nenhuma execução promove ou publica o site.
- Manter os workflows anteriores de QA para comparação de versões históricas.

## Rollback

Caso a alteração seja reprovada antes do merge, abandonar esta branch. Em caso de promoção autorizada no futuro e regressão, abrir PR de reversão do SHA em `validate.yml` e nos **dois testes do pin**, retornando ao SHA F81 acima. Não é necessário alterar URLs públicas, dados ou banco por este ajuste específico de CI.

**NO-GO:** não executar deploy, troca DNS, redirecionamentos 301, OAuth real, token vault, dados de clientes ou merge em main. Exigir CI aprovado, revisão independente AppSec/SEO/LGPD, homologação controlada e decisão específica de promoção.
