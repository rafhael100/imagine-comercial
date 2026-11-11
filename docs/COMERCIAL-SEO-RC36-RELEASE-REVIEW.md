# Imagine Comercial SEO RC36 — Migração legada protegida e staging preparado

A RC36 reúne a RC35 e as melhorias de cobertura de migração:

- **F161 — todos os 18 caminhos em HOLD** são avaliados pelo verificador privado de staging HTTP F159 e pelo Workerd real local, exigindo 404, noindex, sem canonical ou JSON-LD. São 4 rotas públicas + 18 HOLD = **22 requisições HTTP controladas** por execução.
- **F162 — todas as 23 URLs legadas** (5 candidatas + 18 HOLD) recebem teste de navegador Astro Preview real, exigindo 404 sem redirect antes da aprovação de migração. A simulação isolada de 301 continua exclusiva do Workerd descartável e **não representa regras publicadas**.

Evidências históricas:
- [RC35 SEO/build/navegador — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43035313490)
- [RC35 PostgreSQL descartável — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43035313827)
- [RC35 Workerd local — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43035313647)
- [RC35 Lighthouse local — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43035313611)
- [F161 Workerd 18 HOLD — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43035683124)
- [F161 PostgreSQL — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43035683071)
- CI F161 de navegador e CI F162 ainda em execução na criação da candidata.

**Status: REVIEW/HOLD.** A RC36 deverá passar por seus próprios quatro pipelines e revisão independente. Não substituir esses testes por relatórios da RC35.

Para produção ainda faltam inventário externo completo de URLs, validação de HTTP real/domínio legado, equivalência editorial/301 destino a destino, autorização de publicador Portal/CRM, staging Leaseweb privado, controle de segredos/MFA, LGPD, acessibilidade de campo, assinatura/atestado e rollback.

Nenhuma conexão à VPS, publicação, deploy, DNS, redirect 301 real, OAuth Google, merge `main` ou despesa nova foi executada.
