# Imagine Comercial SEO RC33 — Biblioteca editorial e contatos seguros

A candidata RC33 consolida a RC32 e quatro entregas de produto concluídas no site Astro:

- **F152 — filtros de assuntos** em `/conteudos/`, com botões acessíveis, contagem anunciada e funcionamento estático sem JavaScript. Sem `input`, formulários, cookies, rastreadores ou solicitações de rede.
- **F153 — sumário interno** nos artigos, com âncoras estáveis derivadas dos títulos, IDs exclusivos, estrutura semântica e navegação nativa.
- **F154 — leituras relacionadas**: cada artigo apresenta dois outros conteúdos realmente existentes, escolhidos por mapeamento editorial revisado, sem recomendação baseada no histórico de visitante.
- **F155 — proteção rigorosa de contato**: o verificador de links externos aceita apenas mensagens e assuntos exatos das 35 combinações curadas de seis serviços × quatro objetivos opcionais, além dos canais públicos já aprovados; rejeita prefixos genéricos que poderiam ocultar texto de terceiros.

Os controles anteriores permanecem: inventário fechado do HTML público, sitemap e canonical, Schema.org, metadados únicos, links internos, acessibilidade, PostgreSQL efêmero, QA de navegador e Workerd/Lighthouse locais.

Evidências de desenvolvimento:
- [F152 SEO/build/Playwright](https://github.com/rafhael100/imagine-comercial/actions/runs/43029729650), [PostgreSQL](https://github.com/rafhael100/imagine-comercial/actions/runs/43029729601): aprovados.
- [F153 SEO/build/Playwright](https://github.com/rafhael100/imagine-comercial/actions/runs/43030335923), [PostgreSQL](https://github.com/rafhael100/imagine-comercial/actions/runs/43030335954): aprovados.
- [F154 SEO/build/Playwright](https://github.com/rafhael100/imagine-comercial/actions/runs/43030929814), [PostgreSQL](https://github.com/rafhael100/imagine-comercial/actions/runs/43030929697): aprovados.
- F155: testes em andamento na abertura desta RC, exigir aprovação antes de consolidar o status de qualidade.

**GATES NO-GO produção:** revisão editorial dos textos e do guia regional, confirmação dos números/e-mail públicos, IAM/Portal/CRM operacional em staging privado, revisão independente AppSec/DBA/LGPD, migração SEO/URLs legadas e 301 individualmente homologados, plano de rollback e aceite de release. Sem deploy, DNS, merge `main`, dados GSC reais no Git ou novos gastos. Esta RC é apenas uma revisão local.
