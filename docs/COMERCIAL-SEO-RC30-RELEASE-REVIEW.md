# Imagine Comercial — SEO RC30 (revisão de conteúdo e qualidade do site)

A RC30 reúne a integração com o Imagine SEO Engine RC29 (F0–F66) e as alterações do site Comercial F139–F145:

- **F139:** tipo OpenGraph correto em artigos e paridade das prévias Twitter/OG com o canonical
- **F140:** IDs do Schema.org (WebPage, Article e Service) vinculados à URL canônica, com inspeção dos HTMLs compilados
- **F141:** guia editorial contextual sobre contratação de sites em Fortaleza; sem endereço, depoimento, resultado ou oferta local fictícios
- **F142:** recomendações editoriais relacionadas nas páginas de serviços, incluindo ligações contextualizadas com o guia regional
- **F143:** bloqueio de links internos inexistentes ou ambíguos em cada página compilada
- **F144:** verificação de títulos e descrições únicos para todas as páginas indexáveis
- **F145:** verificação do grafo de navegação; nenhuma página pública pode ficar órfã ou a mais de três cliques da home

Evidências de CI:
- [F141 SEO/build/navegador](https://github.com/rafhael100/imagine-comercial/actions/runs/43014845467) e [PostgreSQL](https://github.com/rafhael100/imagine-comercial/actions/runs/43014845480)
- [F142 SEO/build/navegador](https://github.com/rafhael100/imagine-comercial/actions/runs/43015050918) e [PostgreSQL](https://github.com/rafhael100/imagine-comercial/actions/runs/43015050771)
- [F143 SEO/build/navegador](https://github.com/rafhael100/imagine-comercial/actions/runs/43015373213) e [PostgreSQL](https://github.com/rafhael100/imagine-comercial/actions/runs/43015373204)
- [F144 SEO/build/navegador](https://github.com/rafhael100/imagine-comercial/actions/runs/43015822068) e [PostgreSQL](https://github.com/rafhael100/imagine-comercial/actions/runs/43015822083)
- [F145 SEO/build/navegador](https://github.com/rafhael100/imagine-comercial/actions/runs/43016219023) e [PostgreSQL](https://github.com/rafhael100/imagine-comercial/actions/runs/43016219266)

As evidências são de ambientes de teste. **HOLD de publicação:** revisão editorial e de compliance de conteúdo regional; aprovação de contrato/oferta; revisão independente de segurança e QA de staging; validação do domínio, host e plano de redirects; confirmação de condições do Portal/CRM. Não liberar merge `main`, DNS, 301 ou deploy, nem adicionar dados reais de Google Search Console ao repositório. Sem despesas novas.
