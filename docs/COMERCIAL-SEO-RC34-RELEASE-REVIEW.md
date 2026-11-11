# Imagine Comercial SEO RC34 — Biblioteca editorial com cobertura de acessibilidade

A RC34 integra a **RC33** (filtros por assunto F152, sumários F153, leituras relacionadas F154 e bloqueio de mensagens arbitrárias F155) com a **F156**, que acrescenta auditorias automatizadas de acessibilidade nas novas telas:

- Axe-core WCAG 2.0 e 2.1 A/AA na lista `/conteudos/` e em um artigo completo, em mobile e desktop
- Prova de comportamento dos filtros com teclado (foco e Enter), estado `aria-pressed`, contagem de resultados e auditoria do estado filtrado
- Navegação nativa no sumário usando teclado e garantia de visualização completa sem JavaScript
- Restrições anteriores de capturas públicas, scripts de rede, SEO e inventário fechado de HTML continuam vigentes

Evidência CI RC33: [SEO/Playwright](https://github.com/rafhael100/imagine-comercial/actions/runs/43031680228), [PostgreSQL](https://github.com/rafhael100/imagine-comercial/actions/runs/43031680320), [Cloudflare Workerd local](https://github.com/rafhael100/imagine-comercial/actions/runs/43031680287), [Lighthouse local](https://github.com/rafhael100/imagine-comercial/actions/runs/43031680220); todas aprovadas.

Evidência F156: [SEO/Playwright em execução na abertura da RC](https://github.com/rafhael100/imagine-comercial/actions/runs/43032442833); [PostgreSQL aprovado](https://github.com/rafhael100/imagine-comercial/actions/runs/43032442664).

**Release HOLD:** auditoria em CI não substitui avaliação com tecnologias assistivas nem revisão independente. Staging privado Leaseweb, OAuth/tenant no Portal, condições comerciais/contatos, LGPD, plano de migração de URLs, segurança e rollback continuam pendentes. Sem alterações em produção, merge `main`, DNS, redirects 301, clientes reais ou novos custos.
