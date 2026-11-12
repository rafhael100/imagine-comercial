# Imagine Comercial — identidade e experiência v1 (12/11/2026)

Implementação somente em branch de revisão: o site Astro usa como referência a **primeira versão Node do Imagine Portal**, aprovada pela Direção. Logo original PNG no asset local `public/assets/logo-imagine.png` (SHA do objeto Git `678adeceb3a8ecdaeb6b576b9ee18d1bf0396f77`). Nenhum serviço externo, fonte remota ou redesenho.

## Aplicação e limites

- `src/layouts/BaseLayout.astro` é compartilhado pelas páginas comerciais, de serviço, conteúdo e ajuda. Cabeçalho, menu móvel nativo sem JavaScript, botões, cartões, seções claras/escuras, tipografia e foco seguem laranja #F9941D, grafite #171B19, branco e cinza #F7F7F8.
- `src/pages/index.astro` alinha links de objetivos, guias e destaques à identidade; `HeroVisual.astro` preserva ilustração HTML/CSS e passa a mostrar a marca original no mock, com aparência leve.
- WCAG: manter contraste de texto de botões sobre laranja, texto branco sobre grafite e foco visível. Checagem específica de contraste e novo teste de identidade automática.
- Metadados SEO, canonicals sem www, inventário de páginas, rotas, conteúdo comercial, links permitidos e ausência de coleta de PII permanecem iguais. Não adicionar bibliotecas nem interações operacionais.
- O layout-base cobre as páginas que o importam. Os estilos locais antigos de outras páginas ainda precisam de inventário e refinamento visual individual, acompanhado por testes e screenshots; não afirmar que todas as telas estão homologadas.

**Sem merge, deploy, DNS, Cloudflare, pagamentos, cadastro, captação ou mudança de integrações.** A etapa está subordinada aos gates existentes de produto, SEO, permissões e homologação privada.
