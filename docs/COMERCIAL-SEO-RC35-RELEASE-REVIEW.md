# Imagine Comercial SEO RC35 — Preparação de homologação privada, sem deploy

A candidata RC35 consolida RC34 e as entregas adicionais:

- **F157:** assegura em Playwright que URLs legadas selecionadas retornem 404 real, sem redirect, canonical ou JSON-LD antes de aprovação editorial e da migração. Os cinco redirects candidatos são simulados somente na cópia Workerd descartável.
- **F158:** elimina a dependência dos downloads extras de fontes via apt no runner Ubuntu, sem desativar Chromium, Playwright, axe-core ou Lighthouse. Os pipelines tinham falhado anteriormente pela resolução DNS do mirror Ubuntu, antes da execução dos testes.
- **F159:** novo verificador de HTTP de staging privado em `127.0.0.1:PORTA`. Confere quatro páginas 200 e quatro rotas legadas HOLD com 404, os cabeçalhos F28, robots e canonical. Sem URL/host fornecido pelo usuário, sem redirect seguido, com timeout e 1 MiB por corpo.
- **F160:** roda a mesma política F159 contra **Workerd HTTP de verdade, isolado em loopback**, além dos testes anteriores de sitemap, headers, 301 sintético e 404.

### Evidências de CI
- [F158 SEO/build/Playwright — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43034210692)
- [F158 Lighthouse local — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43034210545)
- [F158 PostgreSQL efêmero — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43034210522)
- [F159 SEO/build/Playwright — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43034806264)
- [F159 PostgreSQL — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43034806356)
- [F160 Workerd loopback — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43035103423)
- [F160 PostgreSQL — SUCCESS](https://github.com/rafhael100/imagine-comercial/actions/runs/43035103279)

A RC35 tem CI próprio e revisão independentes; não declarar a versão consolidada aprovada antes de todas as verificações concluídas. A falha histórica da RC34 é de bootstrap externo do browser, não prova de regressão do produto, mas continua documentada.

### Critérios de liberação — todos HOLD
- Ambiente de staging Leaseweb autorizado, isolado em contêiner com MFA e acesso administrativo legítimo
- Revisão independente AppSec/DBA/LGPD e prova de integração Portal/CRM real, sem vazamento ou captação não homologada
- Confirmação editorial do site, oferta e contatos públicos; avaliação com tecnologias assistivas
- Inventário de URLs legadas e equivalência aprovada 1:1; aprovação explícita de redirects, DNS e TLS
- Artefato assinado, testemunho externo e plano de rollback aceitos pelo proprietário do release

Nenhum merge `main`, deploy, DNS, 301 real, OAuth de produção, cobrança nova ou publicação foi realizado pela candidata RC35.
