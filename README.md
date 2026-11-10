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

## Estado do desenvolvimento (10/11/2026)
A implementação Astro e os testes avançados estão na [branch de integração em revisão](https://github.com/rafhael100/imagine-comercial/pull/38), até F50, e **não na `main`**. O site legado em `imaginecomunicacao.com.br` não foi substituído. A revisão de catálogo assinado, SEO/Chromium, Workerd local e Lighthouse funciona em laboratório, mas não corresponde a tráfego real nem a publicação efetiva.

A F49 acrescentou uma proposta de migração PostgreSQL e adaptador de reserva de recibos; a F50 o conectou ao ensaio Astro com um cliente **simulado**, ainda sem PostgreSQL ou witness remoto reais. A migração não foi executada. O [issue #56](https://github.com/rafhael100/imagine-comercial/issues/56) registra a homologação privada Leaseweb, o banco, as autorizações do Portal e a entrega independente. A auditoria SEO real está no [issue #3](https://github.com/rafhael100/imagine-comercial/issues/3) e os contratos de conteúdo do Portal no [issue #4](https://github.com/rafhael100/imagine-comercial/issues/4).

**Proibido presumir aprovação de produção:** faltam staging privado, credenciais seguras, grants/MFA, ledger durável, Search Console e crawl reais, revisão editorial/jurídica/comercial e autorização humana de merge/deploy/DNS. Não incluir dados de clientes, credenciais ou chaves de assinatura em arquivos públicos.

## Marco de laboratório F53 — 10/11/2026

O [PR de integração #38](https://github.com/rafhael100/imagine-comercial/pull/38) passou por Astro/SEO, Cloudflare Workerd, Lighthouse local e **PostgreSQL 16 real, mas exclusivamente em banco descartável do GitHub Actions**. A cadeia testada inclui catálogo e HTML Astro assinados, pins de SHA-256, política de witness Ed25519 assinada por raiz separada e anti-replay no PostgreSQL. Consultar [F51](https://github.com/rafhael100/imagine-comercial/pull/62), [F52](https://github.com/rafhael100/imagine-comercial/pull/64) e [F53](https://github.com/rafhael100/imagine-comercial/pull/65).

**O site existente não foi substituído.** Esses testes não certificam o banco da VPS Leaseweb, testemunha pós-entrega remota, autenticação/MFA/grants operacionais do Portal, integrações duráveis do CRM, GSC real, preços/contratos/privacidade, deploy ou DNS. Continuam pendentes os gates [#56](https://github.com/rafhael100/imagine-comercial/issues/56), [#3](https://github.com/rafhael100/imagine-comercial/issues/3) e [#4](https://github.com/rafhael100/imagine-comercial/issues/4). A `main` permanece documental.

## Atualização F55–F57 — verificação e permissões (10/11/2026)

O [PR integrado de revisão #38](https://github.com/rafhael100/imagine-comercial/pull/38) inclui agora a F55: PostgreSQL real em GitHub-hosted CI com duas funções `SECURITY DEFINER` para política assinada e nonce, papel `EXECUTE` sem acesso direto às tabelas e verificação de assinatura Ed25519 feita no processo Node. A F56 fixa o [auditor independente Imagine SEO RC10](https://github.com/rafhael100/imagine-seo-engine/pull/45) por commit SHA e usa `--fail-on-warnings --strict-public-head`. A F57 reforça a prova negativa dos privilégios SQL e registra esta passagem de desenvolvimento.

**Nenhuma dessas etapas é homologação operacional.** A integração não tem credenciais Leaseweb, Portal/CRM autênticos, witness que leu arquivos publicados, dados reais de GSC nem revisão final de domínio, conteúdo e LGPD. A `main`, produção, DNS e bancos persistentes permanecem intactos.
