# Imagine Comercial — SEO RC31 (acessibilidade e SEO auditável)

Consolida o motor SEO RC29, os aprimoramentos do Comercial F139–F145 da RC30 e mais:
- **F146:** cada página pública deve ter um único H1 descritivo, antes de H2 e H3 sem saltos de nível
- **F147:** verificações de IDs duplicados e `href="#..." ` sem destino no HTML compilado, preservando links de serviço para o fluxo `/contato/#slug`

A RC31 é uma candidata de revisão *offline*. As alterações do site incluem metadados sociais, JSON-LD canônico, guia original de contratação de sites em Fortaleza, links editoriais úteis, links internos sem erro, títulos e descrições exclusivos, detecção de páginas órfãs, estrutura H1/H2 e âncoras funcionais.

Evidências de CI da cadeia:
- [RC30 SEO/build/navegador](https://github.com/rafhael100/imagine-comercial/actions/runs/43016636815), [Cloudflare Workerd loopback](https://github.com/rafhael100/imagine-comercial/actions/runs/43016636662), [Lighthouse local](https://github.com/rafhael100/imagine-comercial/actions/runs/43016637017), [PostgreSQL descartável](https://github.com/rafhael100/imagine-comercial/actions/runs/43016636690)
- [F146 SEO/build/navegador](https://github.com/rafhael100/imagine-comercial/actions/runs/43017082552), [PostgreSQL descartável](https://github.com/rafhael100/imagine-comercial/actions/runs/43017082532)
- [F147 SEO/build/navegador](https://github.com/rafhael100/imagine-comercial/actions/runs/43017375719), [PostgreSQL descartável](https://github.com/rafhael100/imagine-comercial/actions/runs/43017375874)

**REVIEW/HOLD**: CI não substitui auditoria editorial, aprovação de oferta/região, verificação de privacidade, revisão independente de segurança, QA de staging e autorização final de publicação. Não fazer merge na `main`, deploy, mudança de DNS, redirects 301, uso de credenciais Google ou gastos adicionais sem passar pelos gates.
