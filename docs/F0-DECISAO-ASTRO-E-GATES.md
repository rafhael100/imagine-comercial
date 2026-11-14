# F0 — Decisão e gates do Imagine Comercial

**Decisão aprovada pelo responsável (08/11/2026):** seguir diretamente com **Astro**, sem PoC comparativa Astro × Nuxt × Next.js. Repositório independente. Foco maior no site comercial e SEO nacional; SEO Engine independente evolui conforme a necessidade do site.

## Fundamentos
- Astro 7.4.7 como referência inicial de projeto (verificar vulnerabilidades e compatibilidade e gerar lockfile antes da primeira homologação).
- SSG como padrão. SSR e cache dinâmico são extensões possíveis após medir necessidade/limites de publicação em Cloudflare.
- HTML rastreável com título, meta description, canonical, links internos e JSON-LD fiel ao conteúdo.
- Catálogo, preços, promoções, CMS e checkout gerenciados no Portal, por APIs autenticadas e contratos versionados; nenhuma informação financeira é autoridade no frontend.
- SEO Engine analisa e recomenda, mas site deve continuar funcionando sem ele.
- Páginas por cidade não serão geradas automaticamente para indexação em massa. Só após pesquisa de oportunidade, evidências, diferenciação e revisão editorial; bloquear doorway pages.

## Estado técnico real
- Código inicial é uma **fundação estática não publicada**, sem integração real de Portal/SEO Engine.
- Não existe checkout funcional, catálogo em produção, captura de lead ou CMS conectado.
- Testes em Node verificam apenas contratos estáticos. **Build Astro, Lighthouse, CWV, acessibilidade em navegador, testes de integração e de segurança ainda não foram executados.**
- npm lockfile, workflow CI, validação de DNS, robots/canonical contra o domínio atual e estratégia de migração 301 ainda são gates antes de qualquer merge/deploy.
- Não usar dados, chaves ou credenciais reais em repositórios públicos.

## Próximos recortes
1. Auditabilidade do domínio, mapa das URLs atuais e baseline Search Console.
2. Design system e páginas comerciais completas com conteúdo original verificado.
3. Especificação do contrato público de ofertas (read-only), publicação CMS com prévia e rollback.
4. Medição SEO e conversão da jornada Site -> Portal.
5. Pipeline de testes de SEO, performance, segurança e acessibilidade; homologação do deploy sem alterar produção.

Sem merge automático, deploy, custos adicionais, pagamentos ou emissão fiscal reais.
