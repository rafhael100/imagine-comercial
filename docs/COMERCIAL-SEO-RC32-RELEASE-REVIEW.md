# Imagine Comercial SEO RC32 — Navegação íntegra, saída controlada e pacote HTML fechado

A RC32 inclui a RC31 (SEO Engine RC29, conteúdo editorial, JSON-LD, metadados, sitemap, links e acessibilidade) e quatro novas etapas do site Comercial:

| Entrega | Verificação adicionada |
| --- | --- |
| F148 | Âncoras entre páginas devem apontar para IDs reais; exceção estrita para serviço permitido em `/contato/#slug` |
| F149 | Links externos somente para canais públicos permitidos e Portal com login validado; novas abas isoladas com `noopener noreferrer` |
| F150 | `dist` deve conter exatamente as páginas HTML previstas pelo catálogo e a 404; nenhuma prévia ou rascunho pode escapar |
| F151 | Links de páginas publicáveis precisam de nomes acessíveis (texto, `aria-label` ou `img alt`) |

CI de desenvolvimento confirmada:
- [F148 SEO/build/navegador](https://github.com/rafhael100/imagine-comercial/actions/runs/43023320512) e [PostgreSQL](https://github.com/rafhael100/imagine-comercial/actions/runs/43023320531)
- [F149 SEO/build/navegador](https://github.com/rafhael100/imagine-comercial/actions/runs/43023720122) e [PostgreSQL](https://github.com/rafhael100/imagine-comercial/actions/runs/43023720222)
- [F150 SEO/build/navegador](https://github.com/rafhael100/imagine-comercial/actions/runs/43024059415) e [PostgreSQL](https://github.com/rafhael100/imagine-comercial/actions/runs/43024059531)

A F151 deve passar no CI antes que a candidata RC32 seja declarada totalmente validada. A RC31 já havia passado por SEO/build/navegador, PostgreSQL descartável, Workerd em loopback e Lighthouse local.

**HOLD de publicação:** precisa de aprovação editorial da página regional, reconfirmação de contatos oficiais, revisão independente de segurança/privacidade, acesso legítimo a staging Leaseweb, auditoria completa da migração de URLs e aceite de produção. PR draft, sem deploy, merge `main`, DNS, 301, tokens Google ou nova despesa.
