# Imagine Comercial

Site público comercial da Imagine Comunicação Digital — `imaginecomunicacao.com.br`.

**Decisão técnica aprovada (08/11/2026): Astro**, arquitetura **SEO-first** e **híbrida** (SSG como padrão; SSR controlado somente se necessário e após homologação). A prova de conceito comparativa com Next.js/Nuxt foi dispensada por decisão do responsável.

## Responsabilidades
- Páginas comerciais, conteúdo indexável, experiência de conversão e CTAs para o Portal Imagine.
- Core Web Vitals, acessibilidade, metadados, dados estruturados fidedignos, sitemap e URLs canônicas.
- Catálogo publicável e CMS **gerenciados pelo Portal**; o Portal é autoridade sobre identidade, contratos, preços oficiais, checkout, pagamentos e documentos fiscais.
- Imagine SEO Engine separado analisa, monitora e propõe otimizações; não é dependência de disponibilidade do site.

## Estado e segurança
Repositório inicializado documentalmente. **Sem site em produção, DNS modificado, integração real com Portal, SEO Engine, Search Console, pagamento, clientes, credenciais ou dados reais.**

Todo código funcional deve entrar por branch isolada e PR draft, com testes e revisão; sem merge/deploy automático. Não incluir dados pessoais, tokens ou chaves no repositório público.

Diretrizes transversais:
- https://github.com/rafhael100/imagine-portal/issues/99
- https://github.com/rafhael100/imagine-portal/issues/100
- https://github.com/rafhael100/imagine-portal/issues/102
